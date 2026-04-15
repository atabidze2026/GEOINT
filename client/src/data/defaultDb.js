const db = {
  scenarios: [
    {
      id: 1,
      title: 'საწყისი OSINT მისია',
      description: 'ეს არის პირველი TEST სცენარი GEOINT მიმართულებით. გამოიცანით ლოკაციები მიცემული ფოტოების მიხედვით.'
    }
  ],
  tasks: [
    // 10 sample tasks
    ...Array.from({ length: 10 }).map((_, i) => {
      const idx = i + 1;
      let time = 20 - (i * 2);
      if (time < 2) time = 2;
      return {
        id: idx,
        scenario_id: 1,
        level_number: idx,
        image_path: '/uploads/default.svg',
        flag: `osint{test_${idx}}`,
        time_limit: time,
        hints: [`ეტაპი ${idx} - მინიშნება 1`, `ეტაპი ${idx} - მინიშნება 2`]
      };
    })
  ]
};

export default db;
