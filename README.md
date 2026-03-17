# Simple Gemini Chat (GitHub Pages)

Tek ekranlik basit bir chat arayuzu.

## Kurulum

1. Bu dosyayi kopyalayıp `.env` olustur:

```bash
cp .env.example .env
```

2. `GEMINI_API_KEY` degerini kendi key'in ile doldur.
3. Siteyi ac. Uygulama key degerini otomatik olarak `.env` dosyasindan okur.

## Not

Bu proje tamamen istemci tarafinda calisir. `.env` dosyasi da statik olarak yayinlanacagi icin API key gizli kalmaz.
Gercek uretim senaryosu icin key'i bir backend/proxy arkasinda saklaman gerekir.
