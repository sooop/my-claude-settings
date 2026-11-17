# 텍스트 일괄 치환 — sd 대체. 0건 치환이면 실패(exit 1)해서 "조용한 실패"가 없다.
#
# 사용:
#   nu ~/.claude/scripts/replace.nu <패턴> <치환> <파일...> [--regex] [--dry-run] [--allow-zero]
#
# 동작:
#   - 기본은 리터럴 치환. --regex 를 주면 Rust 정규식(`(?m)^`, `$1` 캡처 지원).
#   - CRLF 파일은 LF 로 정규화한 뒤 치환하고, 원래 CRLF 였으면 CRLF 로 되돌려 저장한다.
#     따라서 패턴의 `\n`·`$` 가 줄끝 종류와 무관하게 동작한다(패턴에 `\r` 쓰지 말 것).
#   - UTF-16(BOM) 파일은 건드리지 않고 오류로 보고한다(iconv -f UTF-16 -t UTF-8 로 먼저 정규화).
#   - 파일별 치환 건수를 TSV(file, count, status)로 출력한다.
#   - 한 파일이라도 0건(또는 오류)이면 종료 코드 1. --allow-zero 로 0건을 허용.
def main [
    pattern: string
    replacement: string
    ...files: path
    --regex(-r)
    --dry-run(-n)
    --allow-zero
] {
    if ($files | is-empty) { error make {msg: "파일 인자가 없습니다"} }
    let pat = if $regex { $pattern } else { $pattern | str replace --all --regex '[\\.+*?()|\[\]{}^$]' '\$0' }
    let rep = if $regex { $replacement } else { $replacement | str replace --all '$' '$$' }
    # 리터럴 모드에서도 패턴·치환의 \n 은 개행으로 쓰고 싶을 수 있으므로 별도 처리하지 않는다 — 개행은 --regex 로.

    let rows = $files | each {|f|
        let head = try { open --raw $f | bytes at 0..<2 } catch { 0x[] }
        if $head in [0x[FF FE], 0x[FE FF]] {
            return {file: $f, count: 0, status: "UTF-16 (건너뜀)"}
        }
        let raw = try { open --raw $f | decode utf-8 } catch {|e| return {file: $f, count: 0, status: $"읽기 실패: ($e.msg)"} }
        let crlf = ($raw | str contains "\r\n") and not ($raw | str replace --all "\r\n" "" | str contains "\n")
        let text = if $crlf { $raw | str replace --all "\r\n" "\n" } else { $raw }
        let count = ($text | split row --regex $pat | length) - 1
        if $count > 0 and not $dry_run {
            let out = $text | str replace --all --regex $pat $rep
            let out = if $crlf { $out | str replace --all "\n" "\r\n" } else { $out }
            $out | save --force --raw $f
        }
        {file: $f, count: $count, status: (if $count > 0 { if $dry_run { "dry-run" } else { "ok" } } else { "0건" })}
    }

    print ($rows | to tsv)
    let bad = $rows | where {|r| $r.status == "UTF-16 (건너뜀)" or ($r.status | str starts-with "읽기 실패") or ($r.count == 0 and not $allow_zero) }
    if not ($bad | is-empty) {
        print -e $"실패: ($bad | length)개 파일이 치환되지 않았습니다"
        exit 1
    }
}
