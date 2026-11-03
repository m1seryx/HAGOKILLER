param(
    [string]$DocxPath = (Join-Path $PSScriptRoot '..\HAGOKILLER_PROGRESS_REPORT.docx'),
    [string]$PdfPath = (Join-Path $PSScriptRoot '..\HAGOKILLER_PROGRESS_REPORT.pdf')
)

$ErrorActionPreference = 'Stop'
$resolvedDocx = (Resolve-Path -LiteralPath $DocxPath).Path
$resolvedPdf = [System.IO.Path]::GetFullPath($PdfPath)

$numberedTitles = @(
    'ESP32-based embedded controller',
    'Microphone-based acoustic monitoring',
    'Configurable threshold and rolling-window detection',
    'Air-pump and inflatable-bladder intervention',
    'Solenoid-valve release mechanism',
    'Bluetooth Low Energy communication',
    'Compact binary device protocol',
    'Remote settings and safety commands',
    'Mock hardware simulation',
    'Cross-platform React Native application',
    'Profile, onboarding, and navigation workflow',
    'Real and mock BLE service abstraction',
    'Offline SQLite persistence',
    'Storage migration and web compatibility',
    'Daily statistical aggregation',
    'Night-session reconstruction',
    'Monthly trend classification',
    'Intervention-outcome estimation',
    'Interactive visual analytics',
    'Deterministic wellness recommendation engine',
    'Optional on-device language-model inference',
    'Structured AI-output validation',
    'Critical-result generative-AI bypass',
    'Optional server-assisted assessment',
    'Contextual daily check-in',
    'Wellness-plan history and feedback',
    'Local notification services',
    'Validation and resilience mechanisms',
    'Automated verification'
)

$word = $null
$document = $null

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open($resolvedDocx)

    if ($document.TablesOfContents.Count -gt 0) {
        $document.TablesOfContents.Item(1).Delete()
    }

    $firstText = $document.Paragraphs.Item(1).Range.Text.Trim()
    if ($firstText -eq 'TABLE OF CONTENTS') {
        $document.Paragraphs.Item(1).Range.Delete()
    }

    foreach ($paragraph in @($document.Paragraphs)) {
        $text = $paragraph.Range.Text.Trim([char]13, [char]7, ' ')
        if ([string]::IsNullOrWhiteSpace($text)) { continue }

        if ($paragraph.Range.ListFormat.ListType -ne 0) {
            $paragraph.Range.ListFormat.RemoveNumbers()
        }

        $paragraph.LeftIndent = 0
        $paragraph.RightIndent = 0
        $paragraph.FirstLineIndent = 0
        $paragraph.SpaceAfter = 6
        $paragraph.LineSpacingRule = 1

        if ($numberedTitles -contains $text) {
            $paragraph.Range.Bold = $true
            $paragraph.KeepWithNext = $true
            $paragraph.SpaceBefore = 6
        }
        elseif ($paragraph.Style.NameLocal -eq 'Normal' -and $text.Length -gt 120) {
            $paragraph.Alignment = 3
            $paragraph.FirstLineIndent = $word.CentimetersToPoints(1.27)
        }
    }

    $document.Repaginate()
    $tocRange = $document.Range(0, 0)
    $tocRange.InsertBefore("TABLE OF CONTENTS`r")
    $document.TablesOfContents.Add($document.Range(18, 18), $true, 1, 3) | Out-Null
    $document.TablesOfContents.Item(1).Update()
    $document.Repaginate()

    $document.Save()
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
