$content = Get-Content 'src/components/pages/MarketPage.tsx'
$keep = 0..($content.Length - 1) | Where-Object { $_ -notin (873,874,876) }
$content = $content[$keep]
$content | Set-Content 'src/components/pages/MarketPage.tsx'