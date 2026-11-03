param(
    [string]$InputPath = (Join-Path $PSScriptRoot '..\HAGOKILLER_PROGRESS_REPORT.md'),
    [string]$DocxPath = (Join-Path $PSScriptRoot '..\HAGOKILLER_PROGRESS_REPORT.docx'),
    [string]$PdfPath = (Join-Path $PSScriptRoot '..\HAGOKILLER_PROGRESS_REPORT.pdf')
)

$ErrorActionPreference = 'Stop'

function Convert-InlineMarkdown {
    param([string]$Text)

    $clean = $Text -replace '\*\*', ''
    $clean = $clean -replace '`', ''
    $clean = $clean -replace '\s{2,}$', ''
    return $clean.Trim()
}

function Test-TableSeparator {
    param([string]$Line)
    return $Line -match '^\s*\|(?:\s*:?-+:?\s*\|)+\s*$'
}

function Get-TableCells {
    param([string]$Line)
    $trimmed = $Line.Trim().Trim('|')
    return @($trimmed.Split('|') | ForEach-Object { Convert-InlineMarkdown $_ })
}

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedDocx = [System.IO.Path]::GetFullPath($DocxPath)
$resolvedPdf = [System.IO.Path]::GetFullPath($PdfPath)
$lines = @(Get-Content -LiteralPath $resolvedInput -Encoding UTF8)

$word = $null
$document = $null

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Add()

    $section = $document.Sections.Item(1)
    $section.PageSetup.PaperSize = 7
    $section.PageSetup.TopMargin = $word.CentimetersToPoints(2.54)
    $section.PageSetup.BottomMargin = $word.CentimetersToPoints(2.54)
    $section.PageSetup.LeftMargin = $word.CentimetersToPoints(2.54)
    $section.PageSetup.RightMargin = $word.CentimetersToPoints(2.54)

    $normal = $document.Styles.Item('Normal')
    $normal.Font.Name = 'Times New Roman'
    $normal.Font.Size = 12
    $normal.ParagraphFormat.Alignment = 3
    $normal.ParagraphFormat.LineSpacingRule = 1
    $normal.ParagraphFormat.SpaceAfter = 6

    foreach ($level in 1..3) {
        $style = $document.Styles.Item("Heading $level")
        $style.Font.Name = 'Times New Roman'
        $style.Font.Color = 0
        $style.Font.Bold = $true
        $style.Font.Size = switch ($level) { 1 { 16 } 2 { 14 } default { 12 } }
        $style.ParagraphFormat.SpaceBefore = 10
        $style.ParagraphFormat.SpaceAfter = 6
        $style.ParagraphFormat.KeepWithNext = $true
    }

    $index = 0
    while ($index -lt $lines.Count) {
        $line = $lines[$index]

        if ([string]::IsNullOrWhiteSpace($line) -or $line.Trim() -eq '---') {
            $index++
            continue
        }

        if ($line.TrimStart().StartsWith('|') -and ($index + 1) -lt $lines.Count -and (Test-TableSeparator $lines[$index + 1])) {
            $rows = New-Object System.Collections.Generic.List[object]
            $rows.Add((Get-TableCells $line))
            $index += 2
            while ($index -lt $lines.Count -and $lines[$index].TrimStart().StartsWith('|')) {
                $rows.Add((Get-TableCells $lines[$index]))
                $index++
            }

            $columnCount = ($rows | ForEach-Object { $_.Count } | Measure-Object -Maximum).Maximum
            $range = $document.Content
            $range.Collapse(0)
            $table = $document.Tables.Add($range, $rows.Count, $columnCount)
            $table.Style = 'Table Grid'
            $table.AllowAutoFit = $true
            $table.Rows.Item(1).Range.Bold = $true
            $table.Rows.Item(1).Range.Shading.BackgroundPatternColor = 14277081
            $table.Range.Font.Name = 'Times New Roman'
            $table.Range.Font.Size = 10
            $table.Range.ParagraphFormat.SpaceAfter = 0

            for ($rowIndex = 0; $rowIndex -lt $rows.Count; $rowIndex++) {
                for ($columnIndex = 0; $columnIndex -lt $rows[$rowIndex].Count; $columnIndex++) {
                    $table.Cell($rowIndex + 1, $columnIndex + 1).Range.Text = $rows[$rowIndex][$columnIndex]
                }
            }

            $afterTable = $document.Content
            $afterTable.Collapse(0)
            $afterTable.InsertParagraphAfter()
            continue
        }

        $range = $document.Content
        $range.Collapse(0)
        $paragraph = $document.Paragraphs.Add($range)
        $trimmed = $line.Trim()

        if ($trimmed -match '^(#{1,3})\s+(.+)$') {
            $level = $Matches[1].Length
            $paragraph.Range.Text = Convert-InlineMarkdown $Matches[2]
            $paragraph.Style = "Heading $level"
            if ($index -le 6) {
                $paragraph.Alignment = 1
            }
        }
        elseif ($trimmed -match '^>\s*(.+)$') {
            $paragraph.Range.Text = Convert-InlineMarkdown $Matches[1]
            $paragraph.Range.Italic = $true
            $paragraph.LeftIndent = $word.CentimetersToPoints(0.75)
            $paragraph.RightIndent = $word.CentimetersToPoints(0.75)
            $paragraph.Alignment = 3
        }
        elseif ($trimmed -match '^-\s+(.+)$') {
            $paragraph.Range.Text = "• " + (Convert-InlineMarkdown $Matches[1])
            $paragraph.LeftIndent = $word.CentimetersToPoints(0.75)
            $paragraph.FirstLineIndent = $word.CentimetersToPoints(-0.5)
            $paragraph.Alignment = 3
        }
        elseif ($trimmed -match '^\d+\.\s+(.+)$') {
            $paragraph.Range.Text = ($trimmed -replace '\s{2,}$', '')
            $paragraph.LeftIndent = $word.CentimetersToPoints(0.75)
            $paragraph.FirstLineIndent = $word.CentimetersToPoints(-0.5)
            $paragraph.Alignment = 3
        }
        else {
            $paragraph.Range.Text = Convert-InlineMarkdown $trimmed
            $paragraph.Alignment = 3
            $paragraph.FirstLineIndent = $word.CentimetersToPoints(1.27)
        }

        $paragraph.Range.InsertParagraphAfter()
        $index++
    }

    $footer = $section.Footers.Item(1)
    $footer.Range.ParagraphFormat.Alignment = 1
    $footer.Range.Fields.Add($footer.Range, -1, 'PAGE') | Out-Null

    $document.TablesOfContents.Add($document.Range(0, 0), $true, 1, 3) | Out-Null
    $tocHeading = $document.Range(0, 0)
    $tocHeading.InsertBefore("TABLE OF CONTENTS`r")
    $document.TablesOfContents.Item(1).Update()

    $document.SaveAs2($resolvedDocx, 16)
    $document.ExportAsFixedFormat($resolvedPdf, 17)
}
finally {
    if ($document) {
        $document.Close($false)
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document)
    }
    if ($word) {
        $word.Quit()
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}

Write-Output $resolvedDocx
Write-Output $resolvedPdf
