//! Structured logging service for the PDF Reader application
//!
//! Provides structured logging with JSON output for production builds
//! and human-readable format for development.
//!
//! Note: Currently using tracing crate directly; this module is kept for
//! future structured logging features.

#![allow(dead_code)]

use chrono::Utc;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// Maximum number of log entries to keep in memory
const MAX_LOG_ENTRIES: usize = 1000;

/// Log level enum
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LogLevel::Debug => write!(f, "DEBUG"),
            LogLevel::Info => write!(f, "INFO"),
            LogLevel::Warn => write!(f, "WARN"),
            LogLevel::Error => write!(f, "ERROR"),
        }
    }
}

/// A structured log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub timestamp: String,
    pub level: LogLevel,
    pub target: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<serde_json::Value>,
}

impl LogEntry {
    /// Create a new log entry
    pub fn new(level: LogLevel, target: &str, message: &str) -> Self {
        Self {
            timestamp: Utc::now().to_rfc3339(),
            level,
            target: target.to_string(),
            message: message.to_string(),
            context: None,
        }
    }

    /// Add context to the log entry
    pub fn with_context(mut self, context: serde_json::Value) -> Self {
        self.context = Some(context);
        self
    }
}

/// In-memory log buffer for debugging
struct LogBuffer {
    entries: Vec<LogEntry>,
}

impl LogBuffer {
    fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }

    fn push(&mut self, entry: LogEntry) {
        self.entries.push(entry);
        if self.entries.len() > MAX_LOG_ENTRIES {
            self.entries.remove(0);
        }
    }

    fn get_all(&self) -> Vec<LogEntry> {
        self.entries.clone()
    }

    fn get_filtered(&self, min_level: LogLevel) -> Vec<LogEntry> {
        self.entries
            .iter()
            .filter(|e| e.level >= min_level)
            .cloned()
            .collect()
    }

    fn clear(&mut self) {
        self.entries.clear();
    }
}

/// Global log buffer
static LOG_BUFFER: Lazy<Mutex<LogBuffer>> = Lazy::new(|| Mutex::new(LogBuffer::new()));

/// Add a log entry to the buffer
pub fn log_entry(entry: LogEntry) {
    if let Ok(mut buffer) = LOG_BUFFER.lock() {
        buffer.push(entry);
    }
}

/// Log a debug message
pub fn debug(target: &str, message: &str) {
    let entry = LogEntry::new(LogLevel::Debug, target, message);
    tracing::debug!(target: "pdf_reader", "{}: {}", target, message);
    log_entry(entry);
}

/// Log a debug message with context
pub fn debug_with_context(target: &str, message: &str, context: serde_json::Value) {
    let entry = LogEntry::new(LogLevel::Debug, target, message).with_context(context.clone());
    tracing::debug!(target: "pdf_reader", "{}: {} {:?}", target, message, context);
    log_entry(entry);
}

/// Log an info message
pub fn info(target: &str, message: &str) {
    let entry = LogEntry::new(LogLevel::Info, target, message);
    tracing::info!(target: "pdf_reader", "{}: {}", target, message);
    log_entry(entry);
}

/// Log an info message with context
pub fn info_with_context(target: &str, message: &str, context: serde_json::Value) {
    let entry = LogEntry::new(LogLevel::Info, target, message).with_context(context.clone());
    tracing::info!(target: "pdf_reader", "{}: {} {:?}", target, message, context);
    log_entry(entry);
}

/// Log a warning message
pub fn warn(target: &str, message: &str) {
    let entry = LogEntry::new(LogLevel::Warn, target, message);
    tracing::warn!(target: "pdf_reader", "{}: {}", target, message);
    log_entry(entry);
}

/// Log a warning message with context
pub fn warn_with_context(target: &str, message: &str, context: serde_json::Value) {
    let entry = LogEntry::new(LogLevel::Warn, target, message).with_context(context.clone());
    tracing::warn!(target: "pdf_reader", "{}: {} {:?}", target, message, context);
    log_entry(entry);
}

/// Log an error message
pub fn error(target: &str, message: &str) {
    let entry = LogEntry::new(LogLevel::Error, target, message);
    tracing::error!(target: "pdf_reader", "{}: {}", target, message);
    log_entry(entry);
}

/// Log an error message with context
pub fn error_with_context(target: &str, message: &str, context: serde_json::Value) {
    let entry = LogEntry::new(LogLevel::Error, target, message).with_context(context.clone());
    tracing::error!(target: "pdf_reader", "{}: {} {:?}", target, message, context);
    log_entry(entry);
}

/// Get all log entries
pub fn get_logs() -> Vec<LogEntry> {
    if let Ok(buffer) = LOG_BUFFER.lock() {
        buffer.get_all()
    } else {
        Vec::new()
    }
}

/// Get filtered log entries by minimum level
pub fn get_logs_filtered(min_level: LogLevel) -> Vec<LogEntry> {
    if let Ok(buffer) = LOG_BUFFER.lock() {
        buffer.get_filtered(min_level)
    } else {
        Vec::new()
    }
}

/// Clear all log entries
pub fn clear_logs() {
    if let Ok(mut buffer) = LOG_BUFFER.lock() {
        buffer.clear();
    }
}

/// Format logs for export (human-readable)
pub fn format_logs_for_export(entries: &[LogEntry]) -> String {
    entries
        .iter()
        .map(|e| {
            let context_str = match &e.context {
                Some(c) => format!(" | {}", serde_json::to_string(c).unwrap_or_default()),
                None => String::new(),
            };
            format!(
                "[{}] {} {} - {}{}",
                e.timestamp, e.level, e.target, e.message, context_str
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Format logs as JSON for export
pub fn format_logs_as_json(entries: &[LogEntry]) -> String {
    serde_json::to_string_pretty(entries).unwrap_or_else(|_| "[]".to_string())
}

/// Tauri command to get debug logs
#[tauri::command]
pub async fn get_debug_logs(min_level: Option<String>) -> Result<Vec<LogEntry>, String> {
    let level = match min_level.as_deref() {
        Some("debug") => LogLevel::Debug,
        Some("info") => LogLevel::Info,
        Some("warn") => LogLevel::Warn,
        Some("error") => LogLevel::Error,
        _ => LogLevel::Debug,
    };

    Ok(get_logs_filtered(level))
}

/// Tauri command to clear debug logs
#[tauri::command]
pub async fn clear_debug_logs() -> Result<(), String> {
    clear_logs();
    Ok(())
}

/// Tauri command to export debug logs as text
#[tauri::command]
pub async fn export_debug_logs(format: Option<String>) -> Result<String, String> {
    let entries = get_logs();

    match format.as_deref() {
        Some("json") => Ok(format_logs_as_json(&entries)),
        _ => Ok(format_logs_for_export(&entries)),
    }
}
