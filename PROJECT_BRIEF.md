# PROJECT_BRIEF.md

## Proje Adı

Koşu Bölge Savaşı

---

## Proje Tanımı

Bu uygulama, kullanıcıların koşu sırasında GPS verisi kullanarak harita üzerinde kapalı alanlar (polygon) oluşturduğu ve bu alanların "bölge" olarak kaydedildiği konum bazlı bir mobil oyundur.

Kullanıcılar kendi bölgelerini oluşturabilir ve diğer kullanıcıların bölgelerini ele geçirebilir.

---

## Temel Oyun Mekaniği

* Kullanıcı koşarken GPS noktaları toplanır
* Bu noktalar bir rota oluşturur
* Rota kapandığında bir polygon (alan) oluşur
* Bu alan haritada kullanıcıya ait bir bölge olarak kaydedilir
* Diğer kullanıcılar bu bölgeye girerek ele geçirebilir

---

## Ana Özellikler

### Konum Takibi

* Kullanıcının gerçek zamanlı konumu alınır
* GPS verisi filtrelenir (hatalı noktalar elenir)

### Rota Oluşturma

* Kullanıcı hareket ettikçe nokta listesi oluşur
* Bu noktalar harita üzerinde çizilir

### 3. Polygon (Alan) Oluşturma

* Rota başlangıç noktasına yaklaşırsa kapanır
* Kapalı rota → polygon olur
* Minimum alan ve minimum nokta şartı vardır

### 4. Harita Üzerinde Görselleştirme

* Kullanıcı rotası çizilir
* Oluşturulan bölgeler haritada gösterilir

### 5. Bölge Sistemi

* Her polygon bir kullanıcıya aittir
* Bölgeler harita üzerinde saklanır
* Başkaları tarafından ele geçirilebilir

---

## Kullanıcı Senaryosu

1. Kullanıcı uygulamayı açar
2. Harita ekranını görür
3. "Başlat" diyerek koşuya başlar
4. Koşarken rota oluşur
5. Başlangıç noktasına yaklaşınca alan kapanır
6. Yeni bir bölge oluşturulur
7. Kullanıcı bölgeleri haritada görür

---

## MVP Hedefi

İlk versiyonda amaç:

* Harita açılması
* Kullanıcının konumunun alınması
* Rota çizimi
* Basit polygon oluşturma
* Oluşturulan alanın gösterilmesi

Multiplayer, puan sistemi ve gelişmiş mekanikler daha sonra eklenecek.

---

## Teknik Öncelikler

* Uygulama stabil çalışmalı
* GPS verisi doğru filtrelenmeli
* Polygon hesaplaması güvenilir olmalı
* Harita performansı yüksek olmalı

---

## Şu aşamada yapılmayacaklar

* Sosyal özellikler
* Leaderboard
* Gerçek zamanlı multiplayer
* Karmaşık animasyonlar

---

## Geliştirme Yaklaşımı

* Önce çalışan basit sistem kur
* Sonra doğruluğu artır
* Sonra performans optimize et
* Sonra oyunlaştırma ekle

---

## Not

Bu proje gerçek dünya GPS verisi ile çalıştığı için:

* Gürültülü veri (noise)
* Hatalı konumlar
* Düşük doğruluk

gibi problemler olacaktır. Sistem bu durumlara dayanıklı olmalıdır.
