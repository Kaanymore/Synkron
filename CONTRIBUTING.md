# Katkıda Bulunma Rehberi | Contributing Guide

Synkron'a katkıda bulunmak istediğiniz için teşekkür ederiz! 🎉

## 🇹🇷 Türkçe

### Nasıl Katkıda Bulunabilirim?

1. **Bug Raporu**: Bir hata buldunuz mu? [Issues](../../issues) sayfasından bildirebilirsiniz.
2. **Özellik Talebi**: Yeni bir özellik mi istiyorsunuz? Issue açın ve tartışalım.
3. **Kod Katkısı**: Fork → Branch → PR akışını kullanın.

### Geliştirme Ortamı

```bash
# 1. Repoyu fork edin ve klonlayın
git clone https://github.com/YOUR_USERNAME/synkron.git
cd synkron

# 2. Virtual environment oluşturun
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# 3. Bağımlılıkları yükleyin
pip install -r requirements.txt

# 4. .env dosyasını oluşturun
cp .env.example .env
# .env dosyasını kendi API bilgilerinizle doldurun

# 5. Çalıştırın
python app.py
```

### PR Kuralları

- Her PR tek bir konuya odaklanmalı
- Türkçe veya İngilizce commit mesajları kabul edilir
- Kod stili mevcut yapıyla tutarlı olmalı
- Yeni özellikler için docstring ekleyin

---

## 🇬🇧 English

### How to Contribute?

1. **Bug Reports**: Found a bug? Report it on the [Issues](../../issues) page.
2. **Feature Requests**: Open an issue to discuss new features.
3. **Code Contributions**: Use the Fork → Branch → PR workflow.

### Development Setup

```bash
git clone https://github.com/YOUR_USERNAME/synkron.git
cd synkron
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env
python app.py
```

### PR Guidelines

- Each PR should focus on a single topic
- Commit messages can be in Turkish or English
- Code style should be consistent with the existing codebase
- Add docstrings for new features

## Lisans | License

Katkılarınız MIT lisansı altında yayınlanacaktır.
Your contributions will be released under the MIT license.
