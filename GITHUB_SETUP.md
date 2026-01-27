# GitHub Repository Ayarları Rehberi

Bu rehber, ElasticScope projesini açık kaynak katkılara hazır hale getirmek için yapmanız gereken GitHub repository ayarlarını içerir.

## 1. Genel Ayarlar (Settings > General)

### Repository Bilgileri
- ✅ **Description**: "Modern Elasticsearch management tool with intuitive UI"
- ✅ **Website**: Varsa proje website'iniz
- ✅ **Topics**: Etiketler ekleyin:
  - `elasticsearch`
  - `elasticsearch-client`
  - `elasticsearch-gui`
  - `data-visualization`
  - `typescript`
  - `react`
  - `docker`
  - `opensource`

### Features
- ✅ **Issues**: Aktif (katkıcılar bug ve feature önerisi açabilsin)
- ✅ **Projects**: İsteğe bağlı (proje yönetimi için)
- ✅ **Preserve this repository**: Aktif
- ✅ **Discussions**: İsteğe bağlı (topluluk tartışmaları için)
- ✅ **Sponsorships**: İsteğe bağlı (GitHub Sponsors kullanacaksanız)

### Pull Requests
- ✅ **Allow merge commits**: Aktif
- ✅ **Allow squash merging**: Aktif (önerilen)
- ✅ **Allow rebase merging**: Aktif
- ✅ **Always suggest updating pull request branches**: Aktif
- ✅ **Allow auto-merge**: Aktif
- ✅ **Automatically delete head branches**: Aktif (PR merge olduktan sonra branch'i sil)

## 2. Branch Protection Rules (Settings > Branches)

### Main Branch İçin Koruma Kuralları

**Branch name pattern**: `main`

#### Protection Rules:
- ✅ **Require a pull request before merging**
  - ✅ Require approvals: 1 (tek kişiseniz 0 bırakabilirsiniz)
  - ✅ Dismiss stale pull request approvals when new commits are pushed
  
- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - Status checks: `build`, `lint` (CI workflow'unuzda tanımladığınız job'lar)
  
- ✅ **Require conversation resolution before merging**

- ⚠️ **Require signed commits**: İsteğe bağlı (ekstra güvenlik)

- ⚠️ **Include administrators**: İlk başta kapalı tutabilirsiniz (acil durumlar için)

- ✅ **Allow force pushes**: KAPALI
- ✅ **Allow deletions**: KAPALI

## 3. Collaborators and Teams (Settings > Collaborators)

- Güvendiğiniz katkıcılara **Triage** veya **Write** yetkisi verin
- Başlangıçta sadece siz admin olun
- Zaman içinde aktif katkıcılara yetki artırın

## 4. Webhooks & Integrations (Settings > Webhooks)

İsteğe bağlı entegrasyonlar:
- **Discord/Slack**: Bildirimler için
- **Code quality tools**: CodeClimate, Codecov
- **CI/CD**: GitHub Actions zaten aktif

## 5. Pages (Settings > Pages)

Eğer dokümantasyon sitesi yapacaksanız:
- Source: GitHub Actions
- Custom domain ayarlayabilirsiniz

## 6. Security (Settings > Security)

### Security Advisories
- ✅ **Aktif**: Güvenlik açıklarını raporlamak için

### Dependabot
- ✅ **Dependabot alerts**: Aktif
- ✅ **Dependabot security updates**: Aktif
- ✅ **Dependabot version updates**: Aktif

`.github/dependabot.yml` dosyası ekleyin (ayrı dosya olarak oluşturulacak)

### Code Scanning
- ✅ **CodeQL analysis**: Aktif
- İlk setup için: Security > Code scanning > Set up CodeQL analysis

## 7. Actions (Settings > Actions)

### General
- ✅ **Allow all actions and reusable workflows**: Seçili
- ✅ **Allow GitHub Actions to create and approve pull requests**: Aktif

### Workflow permissions
- ✅ **Read and write permissions**: Seçili (Docker build için gerekli)
- ✅ **Allow GitHub Actions to create and approve pull requests**: Aktif

## 8. Secrets and Variables

### Repository Secrets (Settings > Secrets and variables > Actions)

Şu anki secrets:
- `GITHUB_TOKEN`: Otomatik var
- Docker için ek secret gerekmiyor (GHCR için)

### Repository Variables
İsteğe bağlı environment variables ekleyebilirsiniz

## 9. Labels (Issues > Labels)

Varsayılan labels iyi, ekstra önerileri:
- `good first issue`: Yeni katkıcılar için
- `help wanted`: Yardım isteniyor
- `priority: high/medium/low`: Öncelik seviyeleri
- `type: bug/feature/docs`: Tip etiketleri

## 10. Community Standards (Insights > Community)

Kontrol edin, şunlar tamamlanmalı:
- ✅ Description
- ✅ README
- ✅ Code of conduct
- ✅ Contributing guidelines
- ✅ License
- ✅ Issue templates
- ✅ Pull request template
- ✅ Security policy

## 11. README.md Güncellemeleri

README'ye eklenecekler:
- ✅ Badges (build status, version, license)
- ✅ Contributing section linki
- ✅ Community/Support section
- ✅ Contributors section (gelecekte)

## 12. First-Time Contributor Welcomes

`.github/workflows/greetings.yml` eklemek isteyebilirsiniz (opsiyonel):
- İlk issue/PR açanlara karşılama mesajı gönderir

## Hızlı Başlangıç Checklist

Şu adımları sırayla yapın:

1. ✅ Dosyalar oluşturuldu: CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
2. ✅ Issue templates oluşturuldu
3. ✅ PR template oluşturuldu
4. ⏳ GitHub Settings > General > Topics ekle
5. ⏳ GitHub Settings > General > Features'ı ayarla
6. ⏳ GitHub Settings > Branches > Branch protection rules ekle
7. ⏳ GitHub Settings > Security > Dependabot'u aktif et
8. ⏳ GitHub Settings > Actions > Permissions'ı kontrol et
9. ⏳ README.md'ye badge ve contributing section ekle
10. ⏳ Labels'ı gözden geçir ve ekle

## Commit ve Push

Yeni dosyaları commit edin ve push edin.
