$src = "C:\Users\Adnan\OneDrive\Documents\New project\product-images"
$dst = "C:\Users\Adnan\OneDrive\Documents\New project\assets"

Get-ChildItem "$src\*.png" | Where-Object { $_.Name -notmatch "eft|apex" } | ForEach-Object {
    $dest = Join-Path $dst ("product-" + $_.Name)
    Copy-Item $_.FullName $dest -Force
    Write-Host "Copied: product-$($_.Name)"
}
