use rodio::{Decoder, Source};
use std::io::Cursor;

fn invalid(prefix: &str, detail: &str) -> String {
    format!("{prefix}_INVALID_WAV: {detail}")
}

fn read_u16(bytes: &[u8], at: usize, prefix: &str) -> Result<u16, String> {
    let raw: [u8; 2] = bytes
        .get(at..at + 2)
        .ok_or_else(|| invalid(prefix, "truncated u16"))?
        .try_into()
        .map_err(|_| invalid(prefix, "truncated u16"))?;
    Ok(u16::from_le_bytes(raw))
}

fn read_u32(bytes: &[u8], at: usize, prefix: &str) -> Result<u32, String> {
    let raw: [u8; 4] = bytes
        .get(at..at + 4)
        .ok_or_else(|| invalid(prefix, "truncated u32"))?
        .try_into()
        .map_err(|_| invalid(prefix, "truncated u32"))?;
    Ok(u32::from_le_bytes(raw))
}

pub(crate) fn validate_pcm16_wav(bytes: &[u8], prefix: &str) -> Result<f64, String> {
    validate_pcm16_wav_inner(bytes, prefix, false)
}

/// Groq returns a streaming WAV whose RIFF/data sizes are `u32::MAX`. Once the
/// bounded HTTP body reaches EOF, normalize those sentinels to actual sizes so
/// rodio and the disk cache receive an ordinary seekable WAV.
pub(crate) fn normalize_streaming_pcm16_wav(bytes: &mut [u8], prefix: &str) -> Result<(), String> {
    if bytes.len() < 44 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return Err(invalid(prefix, "missing RIFF/WAVE header"));
    }
    let riff_size = u32::try_from(bytes.len() - 8)
        .map_err(|_| invalid(prefix, "response exceeds WAV size field"))?;
    if read_u32(bytes, 4, prefix)? == u32::MAX {
        bytes[4..8].copy_from_slice(&riff_size.to_le_bytes());
    }

    let mut cursor = 12_usize;
    while cursor + 8 <= bytes.len() {
        let id = &bytes[cursor..cursor + 4];
        let declared = read_u32(bytes, cursor + 4, prefix)?;
        let start = cursor + 8;
        if id == b"data" && declared == u32::MAX {
            let actual = u32::try_from(bytes.len().saturating_sub(start))
                .map_err(|_| invalid(prefix, "data exceeds WAV size field"))?;
            bytes[cursor + 4..cursor + 8].copy_from_slice(&actual.to_le_bytes());
            return Ok(());
        }
        let end = start
            .checked_add(declared as usize)
            .ok_or_else(|| invalid(prefix, "chunk size overflow"))?;
        if end > bytes.len() {
            return Err(invalid(prefix, "truncated chunk"));
        }
        cursor = end + (declared as usize % 2);
        if id == b"data" {
            return Ok(());
        }
    }
    Err(invalid(prefix, "data chunk missing"))
}

fn validate_pcm16_wav_inner(
    bytes: &[u8],
    prefix: &str,
    allow_streaming_sizes: bool,
) -> Result<f64, String> {
    if bytes.len() < 44 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return Err(invalid(prefix, "missing RIFF/WAVE header"));
    }
    let declared_size = read_u32(bytes, 4, prefix)?;
    let streaming_riff = allow_streaming_sizes && declared_size == u32::MAX;
    if !streaming_riff && declared_size as usize + 8 != bytes.len() {
        return Err(invalid(prefix, "RIFF size does not match bytes"));
    }

    let mut cursor = 12_usize;
    let mut format = None;
    let mut data_size = None;
    let mut streaming_data = false;
    while cursor + 8 <= bytes.len() {
        let id = &bytes[cursor..cursor + 4];
        let declared_chunk_size = read_u32(bytes, cursor + 4, prefix)?;
        let start = cursor + 8;
        let is_streaming_data =
            allow_streaming_sizes && id == b"data" && declared_chunk_size == u32::MAX;
        let size = if is_streaming_data {
            bytes.len().saturating_sub(start)
        } else {
            declared_chunk_size as usize
        };
        let end = start
            .checked_add(size)
            .ok_or_else(|| invalid(prefix, "chunk size overflow"))?;
        if end > bytes.len() {
            return Err(invalid(prefix, "truncated chunk"));
        }
        if id == b"fmt " {
            if size < 16 {
                return Err(invalid(prefix, "short fmt chunk"));
            }
            format = Some((
                read_u16(bytes, start, prefix)?,
                read_u16(bytes, start + 2, prefix)?,
                read_u32(bytes, start + 4, prefix)?,
                read_u32(bytes, start + 8, prefix)?,
                read_u16(bytes, start + 12, prefix)?,
                read_u16(bytes, start + 14, prefix)?,
            ));
        } else if id == b"data" {
            data_size = Some(size);
            streaming_data = is_streaming_data;
        }
        cursor = end + (size % 2);
        if is_streaming_data {
            break;
        }
    }

    let (audio_format, channels, sample_rate, byte_rate, block_align, bits) =
        format.ok_or_else(|| invalid(prefix, "fmt chunk missing"))?;
    let data_size = data_size.ok_or_else(|| invalid(prefix, "data chunk missing"))?;
    if audio_format != 1 || !(1..=2).contains(&channels) || bits != 16 {
        return Err(invalid(prefix, "only mono/stereo PCM16 is supported"));
    }
    if !(8_000..=96_000).contains(&sample_rate) {
        return Err(invalid(prefix, "sample rate out of bounds"));
    }
    let expected_align = channels * (bits / 8);
    let expected_rate = sample_rate * u32::from(expected_align);
    if block_align != expected_align
        || byte_rate != expected_rate
        || data_size % usize::from(block_align) != 0
    {
        return Err(invalid(prefix, "inconsistent PCM format"));
    }

    let duration = data_size as f64 / byte_rate as f64;
    let decoder = Decoder::new(Cursor::new(bytes.to_vec()))
        .map_err(|error| invalid(prefix, &format!("rodio decode failed: {error}")))?;
    if !streaming_data {
        if let Some(decoded) = decoder.total_duration() {
            let tolerance = 1.0 / sample_rate as f64;
            if (decoded.as_secs_f64() - duration).abs() > tolerance {
                return Err(invalid(prefix, "decoded duration mismatch"));
            }
        }
    }
    Ok(duration)
}

#[cfg(test)]
pub(crate) fn fixture_pcm_wav() -> Vec<u8> {
    let sample_rate = 16_000_u32;
    let samples = vec![0_i16; 1_600];
    let data_len = (samples.len() * 2) as u32;
    let mut wav = Vec::with_capacity(44 + data_len as usize);
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data_len).to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16_u32.to_le_bytes());
    wav.extend_from_slice(&1_u16.to_le_bytes());
    wav.extend_from_slice(&1_u16.to_le_bytes());
    wav.extend_from_slice(&sample_rate.to_le_bytes());
    wav.extend_from_slice(&(sample_rate * 2).to_le_bytes());
    wav.extend_from_slice(&2_u16.to_le_bytes());
    wav.extend_from_slice(&16_u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_len.to_le_bytes());
    for sample in samples {
        wav.extend_from_slice(&sample.to_le_bytes());
    }
    wav
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_pcm16_and_rejects_truncation_or_float() {
        let valid = fixture_pcm_wav();
        assert!((validate_pcm16_wav(&valid, "TEST").unwrap() - 0.1).abs() < 0.000_001);
        assert!(validate_pcm16_wav(&valid[..valid.len() - 1], "TEST").is_err());
        let mut float = valid;
        float[20..22].copy_from_slice(&3_u16.to_le_bytes());
        assert!(validate_pcm16_wav(&float, "TEST").is_err());

        let mut streaming = fixture_pcm_wav();
        streaming[4..8].copy_from_slice(&u32::MAX.to_le_bytes());
        streaming[40..44].copy_from_slice(&u32::MAX.to_le_bytes());
        assert!(validate_pcm16_wav(&streaming, "TEST").is_err());
        normalize_streaming_pcm16_wav(&mut streaming, "TEST").unwrap();
        assert!((validate_pcm16_wav(&streaming, "TEST").unwrap() - 0.1).abs() < 0.000_001);
    }
}
