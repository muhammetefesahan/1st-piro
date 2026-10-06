# 2026-10-06 - Gölge Timi

- Modern askerî FPS oyunlarından esinlenen, tamamen özgün bir tarayıcı oyunu yazıldı (marka, logo veya oyun varlığı kullanılmadı).
- three.js r128 üstünde 3D dünya; düşük çözünürlüklü çizim, derinlik konturu ve Bayer titreşimli renk basamaklama ile piksel-art görünüm.
- Hareket: her yöne koşu, taktik koşu, kayma, dalış, yüzüstü, tırmanma. Silah: geri tepme, saçılım, şarjör/sürgü/pompa animasyonları, el bombası pişirme.
- 13 silah, 5 eklenti yuvalı Silah Ustası, 3 düzenlenebilir sınıf, 9 yetenek, 4 skor serisi (İHA, hava saldırısı, taret, helikopter).
- Modlar: 5 görevlik hikâye ("Kızıl Sis"), botlara karşı Takım Ölüm Maçı / Bölge Kontrolü / Herkes Tek, Zombiler (kapılar, gizem kutusu, yetenek makineleri, Dönüştürücü, köpek raundu), atış poligonu, online kapışma.
- Kendimize has: çay (T) ve simit (H), zombilerde elektrik istemeyen Çay Ocağı ve "Çay Molası" güçlendirmesi, hikâyede timin çaycısı Rıza.
- Online kapışma Claude "room" yeteneğiyle (presence) çalışır; yoksa BroadcastChannel ile aynı tarayıcıdaki sekmeler arasında yerel deneme modu.
- Yaka fotoğrafı: oyuncu kendi fotoğrafını Ayarlar'dan yükler; yalnızca cihazda saklanır, karakterin yakasında ve HUD'da görünür.
- Saf kurallar (`js/rules.js`, `js/maps.js`) `npm test` kapsamında: silah/eklenti hesapları, zombi formülleri, rütbe, yol bulma ve tüm haritalarda noktaların ulaşılabilirliği.
- Headless Chromium ile tüm modlar (hikâye görevleri hızlandırılmış simülasyonla) konsol hatası olmadan doğrulandı.

## Sürüm 2 — büyük elden geçirme

- **Cephanelik:** 13 silahtan 33 silaha (9 sınıf, 19 farklı gövde tipi). Yeni silah modeli üretici: yandan profil çıkarma, ray, el kundağı, dürbün, ayak, tambur/şerit şarjör.
- **Silah Ustası:** 7 eklenti yuvası (nişangah, namlu ağzı, namlu, alt bağlantı, şarjör, dipçik, mühimmat; 25 parça), değerleri temel silaha göre artı/eksi gösteren çubuklar, öldürme süresi, sürükleyerek döndürülen 3D önizleme.
- **İlerleme:** silah başına öldürme ve seviye, öldürme sayısıyla açılan 10 kamuflaj (Altın 120, Elmas 200), günlük 3 görev (14’lük havuz), madalya sayaçları, 13 rütbe için piksel nişanlar, seviyeyle açılan 6 operatör ve 5 yakın dövüş silahı.
- **Grafik:** operatör ve zombi çeşitleri, kollarda IK, harita süslemeleri ve tabelalar, bulutlu gökyüzü, dalgalı deniz, parlama (bloom) ve harita başına renk ayarı.
- **Arayüz:** sekmeli üst menü (Oyna, Silahlar, Operatörler, İlerleme, Ayarlar), harita görüntülü mod kartları (harita bir kez kurulup görüntü hattından geçirilerek üretilir), yükleme ekranı, maç sonunda silah ilerlemesi ve günlük görevler, tuş atama.
- **HUD:** pusula (bayrak ve hedef işaretleriyle), silah silueti, mermi çubukları, piksel ekipman ikonları, öldürme akışında silah simgeleri, "şarjör değiştir" uyarısı.
- Testler: `npm test` 12 test; headless Chromium ile tüm ekranlar, modlar, hikâye görevleri, iki sekmeli online ve telefon görünümü.
