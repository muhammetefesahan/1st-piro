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
