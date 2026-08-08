Add-Type -AssemblyName System.Drawing

$iconPath = Join-Path $PSScriptRoot 'local-code.ico'
$sizes = @(16, 32, 48, 64, 128, 256)
$bitmaps = New-Object System.Collections.Generic.List[System.Drawing.Bitmap]

foreach ($size in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))

  $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 10, 10, 12))
  $pad = [Math]::Max(1, [int]($size * 0.06))
  $radius = [Math]::Max(2, [int]($size * 0.18))
  $rect = New-Object System.Drawing.Rectangle $pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $radius * 2
  $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
  $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
  $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $g.FillPath($bg, $path)

  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 196, 2, 51), [Math]::Max(1.0, $size / 18.0))
  $g.DrawPath($pen, $path)

  $cyan = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 34, 211, 238))
  $fontSize = [Math]::Max(6.0, $size * 0.42)
  $font = New-Object System.Drawing.Font 'Consolas', $fontSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $g.DrawString('<', $font, $cyan, (New-Object System.Drawing.RectangleF 0, 0, $size, $size), $sf)

  $bitmaps.Add($bmp)
  $g.Dispose(); $bg.Dispose(); $pen.Dispose(); $font.Dispose(); $path.Dispose(); $sf.Dispose()
}

$pngs = New-Object System.Collections.Generic.List[byte[]]
foreach ($bmp in $bitmaps) {
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngs.Add($ms.ToArray())
  $ms.Dispose()
}

$fs = [System.IO.File]::Create($iconPath)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([Int16]0)
$bw.Write([Int16]1)
$bw.Write([Int16]$bitmaps.Count)

$offset = 6 + (16 * $bitmaps.Count)
for ($i = 0; $i -lt $bitmaps.Count; $i++) {
  $s = $sizes[$i]
  $dim = 0
  if ($s -lt 256) { $dim = $s }
  $bw.Write([byte]$dim)
  $bw.Write([byte]$dim)
  $bw.Write([byte]0)
  $bw.Write([byte]0)
  $bw.Write([Int16]1)
  $bw.Write([Int16]32)
  $bw.Write([Int32]$pngs[$i].Length)
  $bw.Write([Int32]$offset)
  $offset += $pngs[$i].Length
}
foreach ($png in $pngs) { $bw.Write($png) }
$bw.Close(); $fs.Close()
foreach ($b in $bitmaps) { $b.Dispose() }

Write-Host "Wrote $iconPath ($((Get-Item $iconPath).Length) bytes)"
