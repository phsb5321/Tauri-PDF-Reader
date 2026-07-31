#!/usr/bin/env bash
set -Eeuo pipefail

if (($# != 1)); then
  echo "usage: $0 <review-output>" >&2
  exit 2
fi

review_path=$1
[[ -f $review_path ]] || {
  echo "adversarial-verdict: missing review output: $review_path" >&2
  exit 2
}

first_line=$(awk 'NF { sub(/\r$/, ""); print; exit }' "$review_path")
case $first_line in
  PASS)
    echo "adversarial-verdict: PASS"
    ;;
  BLOCK)
    echo "adversarial-verdict: BLOCK" >&2
    exit 1
    ;;
  *)
    printf 'adversarial-verdict: unrecognized first line: %q\n' "$first_line" >&2
    exit 2
    ;;
esac
