# Voice Commands

The app uses **two-pass command matching**: an exact substring pass first, then a fuzzy (Levenshtein) pass that tolerates minor speech-recognition slips (e.g. "start engin" still matches "start engine").

> **Quick start:** Click **"Open Radio Channel"** / **"Buka Saluran Radio"** → speak a command → the radio auto-reopens for the next command. No microphone? Use the **Manual Controls** button grid.

---

## English Commands

### 🏎️ Engine & Car Control

| Say This | What Happens |
|---|---|
| `start engine` | Fires up the engine (1st gear, 4000 RPM) |
| `stop engine` / `shut down` | Stops the engine |
| `reset` / `new race` / `restart` | Resets everything for a new race |

### DRS & Overtake

| Say This | What Happens |
|---|---|
| `drs` / `activate drs` | Enables DRS (requires engine + within 1s of rival) |
| `drs off` / `close drs` / `disable drs` | Disables DRS |
| `overtake` / `over take` | Deploys 8s overtake boost (costs 20% battery) |

### ⛽ Fuel & Energy

| Say This | What Happens |
|---|---|
| `lean mix` / `lean mixture` | Lean fuel mix (saves fuel, less power) |
| `standard mix` / `normal mix` | Standard fuel mix |
| `rich mix` / `rich mixture` | Rich fuel mix (more power, burns more) |
| `hotlap` / `ers hot` | ERS Hotlap mode (fast recharge) |
| `balanced mode` / `ers balanced` | ERS Balanced mode |
| `charge mode` / `ers charge` | ERS Charge mode (harvests energy) |

### 🛞 Tires & Pit Stops

| Say This | What Happens |
|---|---|
| `soft tire` / `soft compound` | Fit Soft tires (fast but wear quickly) |
| `medium tire` / `medium compound` | Fit Medium tires (balanced) |
| `hard tire` / `hard compound` | Fit Hard tires (slow but last longer) |
| `pit stop` / `box box` / `pit now` | Enter the pits (4s stop, full service) |

### 📊 Status Queries

| Say This | Response |
|---|---|
| `tire temp` / `tire temperature` | Tire temperature in °C and status |
| `tire` / `tire status` | Tire compound, status, and remaining life |
| `fuel` / `fuel status` | Current fuel level |
| `battery` / `battery status` | Current battery level |
| `temp` / `temperature` / `engine temp` | Engine temperature and status |
| `damage` / `car damage` | Damage percentage and severity |
| `weather` / `weather status` | Current weather condition |
| `pit window` / `pit strategy` | Recommended pit lap or "Box now!" |
| `my position` / `standing` / `where am i` | Race position and gap to rival |
| `what lap` / `lap status` / `lap` | Current lap number |
| `best lap` / `fastest lap` / `lap record` | Best lap time so far |
| `help` / `what can i say` / `commands` | Lists available voice commands |

### 🌦️ Weather

| Say This | Effect |
|---|---|
| `dry track` / `set dry` | Switch to Dry conditions |
| `cloudy` / `overcast` | Switch to Cloudy conditions |
| `wet track` / `rain` / `rainy` | Switch to Wet conditions |
| `storm` / `stormy` / `heavy rain` | Switch to Storm conditions |

### 🤖 AI Rival

| Say This | Effect |
|---|---|
| `easy mode` / `rival easy` | Enable AI on Easy (slow, inconsistent) |
| `rival medium` / `medium difficulty` | Enable AI on Medium (balanced) |
| `hard mode` / `rival hard` | Enable AI on Hard (fast, consistent) |
| `random rival` / `surprise me` | Enable AI on random difficulty |
| `rival off` / `ai off` / `no rival` | Disable the AI rival |
| `rival status` / `ai status` / `opponent` | Check AI rival's current lap and best time |

### 🏁 Qualifying Mode

| Say This | Effect |
|---|---|
| `qualifying` / `quali` / `qualy` | Start a 3-lap qualifying session |
| `qualifying status` / `quali status` | Check remaining laps and current best |
| `qualifying best lap` / `quali best` | Hear your best qualifying lap time |

### 🏎️ Car Selection

| Say This | Effect |
|---|---|
| `speedster` / `car speedster` | Select Speedster (top speed, high wear) |
| `balanced car` / `select balanced` | Select Balanced (all-rounder) |
| `grip master` / `car grip` | Select Grip Master (cornering, slow straights) |
| `endurance` / `car endurance` | Select Endurance (saves tires/fuel, low speed) |

---

## Bahasa Indonesia

### 🏎️ Mesin & Kontrol Mobil

| Perintah | Fungsi |
|---|---|
| `nyalakan mesin` / `hidupkan mesin` | Menyalakan mesin |
| `matikan mesin` / `stop mesin` | Mematikan mesin |
| `atur ulang` / `balapan baru` / `reset` | Mengatur ulang balapan |

### DRS & Menyalip

| Perintah | Fungsi |
|---|---|
| `drs` | Mengaktifkan DRS |
| `drs mati` / `tutup drs` / `matikan drs` | Menonaktifkan DRS |
| `salip` / `menyalip` / `nyalip` | Mengaktifkan mode menyalip |

### ⛽ Bahan Bakar & Energi

| Perintah | Fungsi |
|---|---|
| `campuran irit` / `mode irit` | Campuran bahan bakar irit |
| `campuran standar` / `mode standar` | Campuran standar |
| `campuran kaya` / `mode kaya` | Campuran kaya (boros, lebih bertenaga) |
| `ers hotlap` / `mode hotlap` | Mode ERS Hotlap |
| `ers seimbang` / `mode seimbang` | Mode ERS Seimbang |
| `mode isi` / `ers isi` / `isi baterai` | Mode ERS Charge |

### 🛞 Ban & Pit Stop

| Perintah | Fungsi |
|---|---|
| `ban lunak` | Pasang ban lunak |
| `ban sedang` / `ban medium` | Pasang ban sedang |
| `ban keras` | Pasang ban keras |
| `pit stop` / `masuk pit` / `ke pit` | Masuk pit stop |

### 📊 Status

| Perintah | Respon |
|---|---|
| `suhu ban` / `temperatur ban` | Suhu ban dalam °C dan status |
| `ban` / `status ban` | Status ban (kompon, umur) |
| `bahan bakar` / `bensin` / `tangki` | Level bahan bakar |
| `baterai` | Level baterai |
| `suhu` / `temperatur` / `status suhu` | Suhu mesin dan status |
| `kerusakan` / `kondisi mobil` | Persentase kerusakan |
| `status cuaca` / `kondisi` | Kondisi cuaca saat ini |
| `jendela pit` / `strategi pit` | Rekomendasi lap untuk pit stop |
| `posisi saya` / `posisi` / `peringkat saya` | Posisi balapan |
| `status lap` / `lap berapa` / `lap` | Nomor lap saat ini |
| `lap tercepat` / `rekor lap` / `lap terbaik` | Waktu lap terbaik |
| `bantuan` / `tolong` / `perintah apa` | Daftar perintah suara |

### 🌦️ Cuaca

| Perintah | Efek |
|---|---|
| `cuaca kering` / `trek kering` | Ganti ke kondisi Kering |
| `berawan` / `mendung` | Ganti ke kondisi Berawan |
| `lintasan basah` / `hujan` | Ganti ke kondisi Basah |
| `badai` / `hujan deras` | Ganti ke kondisi Badai |

### 🤖 Lawan AI

| Perintah | Efek |
|---|---|
| `mode mudah` / `lawan mudah` | Aktifkan AI level Mudah |
| `lawan sedang` / `tingkat sedang` | Aktifkan AI level Sedang |
| `mode sulit` / `lawan sulit` | Aktifkan AI level Sulit |
| `lawan acak` / `tingkat acak` | Aktifkan AI level Acak |
| `lawan mati` / `tanpa lawan` | Nonaktifkan lawan AI |
| `status lawan` / `status ai` | Cek status lawan AI |

### 🏁 Kualifikasi

| Perintah | Efek |
|---|---|
| `kualifikasi` / `kuali` / `mode kualifikasi` | Mulai sesi kualifikasi (3 lap) |
| `status kualifikasi` / `status quali` | Cek sisa lap dan waktu terbaik |
| `lap terbaik kualifikasi` / `terbaik quali` | Dengar waktu kualifikasi terbaik |

### 🏎️ Pilih Mobil

| Perintah | Efek |
|---|---|
| `speedster` / `mobil speedster` | Pilih Speedster (kecepatan tinggi) |
| `mobil seimbang` / `pilih seimbang` | Pilih Balanced (serba bisa) |
| `grip master` / `mobil grip` | Pilih Grip Master (hantaman tikungan) |
| `endurance` / `mobil endurance` | Pilih Endurance (irit ban & bensin) |
