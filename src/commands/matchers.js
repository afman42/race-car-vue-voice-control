export const COMMAND_MATCHERS = [
  {
    command: "help",
    keywords: {
      en: ["help", "what can i say", "commands"],
      id: ["bantuan", "tolong", "perintah apa", "daftar perintah"],
    },
  },
  {
    command: "pitStop",
    keywords: {
      en: ["pit stop", "box box", "pit now"],
      id: ["pit stop", "masuk pit", "ke pit"],
    },
  },
  {
    command: "reset",
    keywords: {
      en: ["reset", "new race", "restart"],
      id: ["atur ulang", "balapan baru", "mulai ulang", "reset"],
    },
  },
  {
    command: "aiOff",
    keywords: {
      en: ["rival off", "ai off", "no rival", "disable rival"],
      id: ["lawan mati", "matikan lawan", "tanpa lawan"],
    },
  },
  {
    command: "aiEasy",
    keywords: {
      en: ["easy mode", "rival easy", "easy rival", "easy difficulty"],
      id: ["mode mudah", "lawan mudah", "tingkat mudah"],
    },
  },
  {
    command: "aiMedium",
    keywords: {
      en: ["medium mode", "rival medium", "medium difficulty"],
      id: ["mode sedang", "lawan sedang", "tingkat sedang"],
    },
  },
  {
    command: "aiHard",
    keywords: {
      en: ["hard mode", "rival hard", "hard difficulty"],
      id: ["mode sulit", "lawan sulit", "tingkat sulit"],
    },
  },
  {
    command: "aiRandom",
    keywords: {
      en: ["random rival", "random difficulty", "random mode", "surprise me"],
      id: ["lawan acak", "tingkat acak", "mode acak"],
    },
  },
  {
    command: "aiStatus",
    keywords: {
      en: ["rival status", "ai status", "rival", "opponent"],
      id: ["status lawan", "lawan", "status ai"],
    },
  },
  {
    command: "startEngine",
    keywords: {
      en: ["start engine"],
      id: ["nyalakan mesin", "hidupkan mesin", "start mesin"],
    },
  },
  {
    command: "stopEngine",
    keywords: {
      en: ["stop engine", "shut down"],
      id: ["matikan mesin", "stop mesin"],
    },
  },
  {
    command: "tireSoft",
    keywords: {
      en: ["soft tire", "soft tyre", "soft compound"],
      id: ["ban lunak", "ban empuk"],
    },
  },
  {
    command: "tireMedium",
    keywords: {
      en: ["medium tire", "medium tyre", "medium compound"],
      id: ["ban sedang", "ban medium"],
    },
  },
  {
    command: "tireHard",
    keywords: {
      en: ["hard tire", "hard tyre", "hard compound"],
      id: ["ban keras"],
    },
  },
  {
    command: "fuelMixLean",
    keywords: {
      en: ["lean mix", "lean mixture", "mix lean"],
      id: ["campuran irit", "mode irit"],
    },
  },
  {
    command: "fuelMixRich",
    keywords: {
      en: ["rich mix", "rich mixture", "mix rich"],
      id: ["campuran kaya", "mode kaya"],
    },
  },
  {
    command: "fuelMixStandard",
    keywords: {
      en: ["standard mix", "standard mixture", "mix standard", "normal mix"],
      id: ["campuran standar", "mode standar"],
    },
  },
  {
    command: "ersHotlap",
    keywords: {
      en: ["hotlap", "hot lap", "ers hot"],
      id: ["ers hotlap", "mode hotlap"],
    },
  },
  {
    command: "ersCharge",
    keywords: {
      en: ["charge mode", "ers charge", "harvest"],
      id: ["mode isi", "ers isi", "isi baterai"],
    },
  },
  {
    command: "ersBalanced",
    keywords: {
      en: ["balanced mode", "ers balanced", "balance ers"],
      id: ["mode seimbang", "ers seimbang"],
    },
  },
  {
    command: "overtake",
    keywords: {
      en: ["overtake", "over take"],
      id: ["salip", "menyalip", "nyalip"],
    },
  },
  {
    command: "deactivateDrs",
    keywords: {
      en: ["close drs", "disable drs", "drs off"],
      id: ["drs mati", "tutup drs", "matikan drs"],
    },
  },
  {
    command: "activateDrs",
    keywords: { en: ["drs"], id: ["drs"] },
  },
  // Qualifying — specific phrases first, generic "quali" last
  {
    command: "qualifyingStatus",
    keywords: {
      en: ["qualifying status", "quali status", "qualy status"],
      id: ["status kualifikasi", "status quali"],
    },
  },
  {
    command: "qualifyingBest",
    keywords: {
      en: ["qualifying best lap", "quali best", "qualy best"],
      id: ["lap terbaik kualifikasi", "terbaik quali"],
    },
  },
  {
    command: "startQualifying",
    keywords: {
      en: ["qualifying mode", "start qualifying", "qualifying", "qualy", "quali"],
      id: ["mode kualifikasi", "mulai kualifikasi", "kualifikasi", "kuali"],
    },
  },
  {
    command: "position",
    keywords: {
      en: ["my position", "position", "standing", "where am i"],
      id: ["posisi saya", "posisi", "peringkat saya"],
    },
  },
  {
    command: "bestLap",
    keywords: {
      en: ["best lap", "fastest lap", "lap record"],
      id: ["lap tercepat", "rekor lap", "lap terbaik"],
    },
  },
  {
    command: "lapStatus",
    keywords: {
      en: ["lap status", "what lap", "current lap", "lap"],
      id: ["status lap", "lap berapa", "lap"],
    },
  },
  {
    command: "weatherDry",
    keywords: {
      en: ["dry weather", "dry track", "set dry"],
      id: ["cuaca kering", "lintasan kering", "trek kering"],
    },
  },
  {
    command: "weatherCloudy",
    keywords: {
      en: ["cloudy weather", "cloudy", "overcast"],
      id: ["cuaca berawan", "berawan", "mendung"],
    },
  },
  {
    command: "weatherWet",
    keywords: {
      en: ["wet weather", "wet track", "rain", "rainy"],
      id: ["cuaca basah", "lintasan basah", "hujan"],
    },
  },
  {
    command: "weatherStorm",
    keywords: {
      en: ["storm", "stormy", "heavy rain"],
      id: ["badai", "hujan deras"],
    },
  },
  {
    command: "weatherStatus",
    keywords: {
      en: ["weather status", "weather", "conditions"],
      id: ["status cuaca", "cuaca", "kondisi"],
    },
  },
  {
    command: "damageStatus",
    keywords: {
      en: ["damage", "car damage", "condition"],
      id: ["kerusakan", "kondisi mobil"],
    },
  },
  // Tire temperature — before generic "temp" matcher so "tire temperature"
  // matches tireTempStatus, not tempStatus.
  {
    command: "tireTempStatus",
    keywords: {
      en: ["tire temperature", "tire temp", "tyre temperature"],
      id: ["suhu ban", "temperatur ban"],
    },
  },
  {
    command: "tempStatus",
    keywords: {
      en: ["temperature", "engine temp", "temp status", "temp"],
      id: ["suhu", "temperatur", "status suhu"],
    },
  },
  {
    command: "tireStatus",
    keywords: { en: ["tire", "tyre"], id: ["ban", "status ban"] },
  },
  {
    command: "fuelStatus",
    keywords: {
      en: ["fuel", "tank", "gas"],
      id: ["bahan bakar", "bensin", "tangki"],
    },
  },
  {
    command: "batteryStatus",
    keywords: { en: ["battery"], id: ["baterai"] },
  },
  // Pit window status — must come before generic "pit" keywords
  {
    command: "pitWindowStatus",
    keywords: {
      en: ["pit window", "window status", "box window", "pit strategy"],
      id: ["jendela pit", "strategi pit"],
    },
  },
  // Car selection — must come before any generic "car" keyword.
  {
    command: "carSpeedster",
    keywords: {
      en: ["speedster", "car speedster", "select speedster"],
      id: ["speedster", "mobil speedster"],
    },
  },
  {
    command: "carBalanced",
    keywords: {
      en: ["balanced car", "car balanced", "select balanced"],
      id: ["mobil seimbang", "pilih seimbang"],
    },
  },
  {
    command: "carGripmaster",
    keywords: {
      en: ["grip master", "car grip", "select grip"],
      id: ["grip master", "mobil grip"],
    },
  },
  {
    command: "carEndurance",
    keywords: {
      en: ["endurance", "car endurance", "select endurance"],
      id: ["endurance", "mobil endurance"],
    },
  },
];
