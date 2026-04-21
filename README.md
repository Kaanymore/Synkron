<div align="center">

# ⚡ Synkron

### E-Commerce Customer Intelligence Platform

**Müşteri verilerinizi analiz edin, temizleyin, otomatik düzeltin.**

[![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)](CONTRIBUTING.md)

---

*E-ticaret mağazanızdaki müşteri verilerini tek bir panelden yönetin.*
*Kopya kayıtları bulun, hatalı numaraları otomatik düzeltin, veritabanınızı temizleyin.*

</div>

---

## 🎯 Nedir?

**Synkron**, e-ticaret platformlarına bağlanarak müşteri verilerinizi analiz eden, sorunları tespit eden ve otomatik düzeltme sağlayan açık kaynaklı bir yönetim panelidir.

Binlerce müşteri kaydını saniyeler içinde tarayarak:
- 📞 **Hatalı telefon numaralarını** otomatik düzeltir
- 🔄 **Kopya kayıtları** tespit eder
- 📧 **Mükerrer e-postaları** bulur
- 🗑️ **Toplu silme** ile veritabanını temizler

---

## ✨ Özellikler

### 📊 Anlık İstatistik Panosu
Sayfa açılır açılmaz toplam müşteri sayısı, numarasız müşteriler ve analiz sonuçları görüntülenir.

### 🔍 Derin Analiz Motoru
Arka planda çalışan analiz motoru tüm müşteriöri tarar ve sınıflandırır:
- **Aynı Telefon Numaraları** — Kopya kayıtları gruplayarak gösterir
- **Aynı E-posta Adresleri** — Mükerrer mail adreslerini tespit eder
- **Hatalı Numaralar** — +90 ile başlamayan tüm numaraları listeler

### 🪄 Telefon Numarası Otomatik Düzeltme
Hatalı formatlı Türk telefon numaralarını **tek tıkla** veya **toplu** olarak düzeltir:

| Mevcut Format | Otomatik Düzeltme | Sonuç |
|:---:|:---:|:---:|
| `5330874047` | +90 ekle | `+905330874047` |
| `05330874047` | 0'ı kaldır, +90 ekle | `+905330874047` |
| `905330874047` | + ekle | `+905330874047` |

> ⚠️ Tanınmayan formatlar atlanır — hiçbir veri bozulmaz.

### 🔎 Müşteri Arama
İsim, e-posta veya telefon numarası ile anlık arama yapın.

### 🏙️ İl / İlçe Filtreleme
Analiz sonuçlarını şehir ve ilçe bazında filtreleyin.

### ✏️ Manuel Düzenleme
Her müşterinin telefon numarasını tek tek güncelleyebilirsiniz.

### 🗑️ Tekli ve Toplu Silme
Tek bir müşteriyi veya seçili müşterileri kalıcı olarak silin. Silme öncesi onay istenir.

### ⚙️ API Ayarları
Client ID ve Client Secret bilgilerini arayüz üzerinden güncelleyin. Bilgiler `.env` dosyasına kaydedilir.

---

## 🚀 Kurulum

### Gereksinimler
- Python 3.8+
- pip

### Adımlar

```bash
# 1. Klonlayın
git clone https://github.com/YOUR_USERNAME/synkron.git
cd synkron

# 2. Virtual environment (önerilen)
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

# 3. Bağımlılıkları yükleyin
pip install -r requirements.txt

# 4. API bilgilerinizi girin
cp .env.example .env
# .env dosyasını düzenleyin

# 5. Çalıştırın
python app.py
```

Tarayıcınızda otomatik olarak `http://127.0.0.1:5000` açılacaktır.

---

## 📁 Proje Yapısı

```
synkron/
├── app.py                 # Flask backend + API endpoints
├── requirements.txt       # Python bağımlılıkları
├── .env.example           # Örnek ortam değişkenleri
├── .gitignore
├── LICENSE                # MIT
├── CONTRIBUTING.md        # Katkı rehberi
├── README.md
├── icon.png               # Uygulama ikonu
├── static/
│   ├── icon.png
│   ├── css/
│   │   └── style.css      # Tasarım sistemi
│   └── js/
│       └── app.js         # Frontend mantığı
└── templates/
    └── index.html         # HTML iskeleti
```

---

## 🛡️ Güvenlik

- API anahtarlarınız **asla** repoya eklenmez (`.gitignore` ile korunur)
- Gerçek veriler yalnızca sizin tarayıcınızda görüntülenir
- Tüm API çağrıları OAuth2 token ile yapılır

---

## 🏗️ Teknoloji Yığını

| Bileşen | Teknoloji |
|---------|----------|
| Backend | Python 3 + Flask |
| Frontend | Vanilla JS + CSS (Inter font) |
| API | GraphQL (e-commerce platform) |
| Auth | OAuth2 Client Credentials |

---

## 🤝 Katkıda Bulunun

Katkılarınızı bekliyoruz! Detaylar için [CONTRIBUTING.md](CONTRIBUTING.md) dosyasına bakın.

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.

---

<div align="center">

**⚡ Synkron ile müşteri verinizi kontrol altına alın.**

</div>
