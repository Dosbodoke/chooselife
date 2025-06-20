export const startDate = new Date("2025-06-19");
export const endDate = new Date("2025-06-22");
export const highlinesID = [
  "162394aa-0653-4b6f-b78a-612bb2697a03",
  "636b62f3-872f-4e18-9df2-3e9645606d62",
  "71f1c6cb-d143-4045-9e56-124c16f816f1",
  "2c770cf7-de3f-4a37-b6ad-038d6c652143",
  "a5b66ee3-eb74-4e89-93db-1bc2e99f0862",
  "814a8fd1-b94d-4da9-9685-34cd224a6e80",
  "180dc7ea-414b-4346-afb8-2171567877fc",
  "01b16bef-5557-494a-a41a-98fe7cbcbbb8",
  "778481da-b694-495e-93bd-9eaa7bef7693",
  "00e4b92f-157c-4257-8e14-eb706e686bea",
  "fccad60b-f8b1-43ae-a013-2427c06ca188",
  "c05dde8f-bed8-4ae0-8a7b-cea9377af714",
  "172d2d4b-7cbf-454c-992d-633b7b8e047d",
  "fb915269-975f-4788-a337-6c9b48997eb4",
];

export type TScheduleData = {
  id: number;
  title: string;
  instructor?: string;
  startAt: string;
  type?: "workshop" | "competition";
  location?: string;
  day?: string;
};

export const scheduleData: TScheduleData[] = [
  // --- Feira Life (Todos os dias) ---
  {
    id: 1,
    title: "Feira Life",
    instructor: "Produtos Locais, Terapias, Artesanato e mais",
    startAt: "08:00 - 18:00",
    location: "🎪 Feira Life",
    day: "2025-06-19",
  },
  {
    id: 2,
    title: "Feira Life",
    instructor: "Produtos Locais, Terapias, Artesanato e mais",
    startAt: "08:00 - 18:00",
    location: "🎪 Feira Life",
    day: "2025-06-20",
  },
  {
    id: 3,
    title: "Feira Life",
    instructor: "Produtos Locais, Terapias, Artesanato e mais",
    startAt: "08:00 - 18:00",
    location: "🎪 Feira Life",
    day: "2025-06-21",
  },
  {
    id: 4,
    title: "Feira Life",
    instructor: "Produtos Locais, Terapias, Artesanato e mais",
    startAt: "08:00 - 18:00",
    location: "🎪 Feira Life",
    day: "2025-06-22",
  },

  // --- Quinta-feira: 2025-06-19 ---
  {
    id: 5,
    title: "Yoga y Respiracion",
    instructor: "Micaela Franzel",
    startAt: "08:00 - 09:00",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-19",
  },
  {
    id: 6,
    title: "Qualificatórias do Speedline (Masc/Fem)",
    startAt: "09:00 - 17:30",
    type: "competition",
    location: "🤸 Copa do Mundo de Highline",
    day: "2025-06-19",
  },
  {
    id: 7,
    title: "Classificatórias do Freestyle (Masc/Fem)",
    startAt: "09:00 - 17:30",
    type: "competition",
    location: "🤸 Copa do Mundo de Highline",
    day: "2025-06-19",
  },
  {
    id: 8,
    title: "Highline Aberto ao Público",
    startAt: "09:00 - 17:30",
    type: "workshop",
    location: "🤸 Área de Highline",
    day: "2025-06-19",
  },
  {
    id: 9,
    title: "Altinha",
    instructor: "Federalta",
    startAt: "09:30 - 10:30",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-19",
  },
  {
    id: 10,
    title: "LACAM - oficina de produtos canábicos",
    instructor: "LACAM / Magrão Canábico",
    startAt: "11:00 - 12:30",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-19",
  },
  {
    id: 11,
    title: "Espaço Cuidado (Acupuntura, Auriculoterapia, Ventosaterapia)",
    instructor: "Nathália Tavares",
    startAt: "13:00 - 16:00",
    type: "workshop",
    location: "🌿 Espaço Cuidado",
    day: "2025-06-19",
  },
  {
    id: 12,
    title: "Sunset no Complexo Veredas",
    startAt: "16:00",
    location: "🏞️ Cerrado Trail",
    day: "2025-06-19",
  },
  {
    id: 13,
    title: "Roda de Conversa - Ouvidoria Delas",
    startAt: "16:30 - 17:30",
    location: "🎪 Área de Convivência",
    day: "2025-06-19",
  },
  {
    id: 14,
    title: "Oficina de Iniciação ao Highline",
    instructor: "Paloma Hess",
    startAt: "17:30 - 18:30",
    type: "workshop",
    location: "🤸 Copa do Mundo de Highline",
    day: "2025-06-19",
  },
  {
    id: 15,
    title: "Cerimônia de Abertura do Festival",
    startAt: "18:30 - 20:00",
    location: "🎪 Área de Convivência",
    day: "2025-06-19",
  },
  {
    id: 16,
    title: "DJ Tárick",
    startAt: "19:00 - 21:00",
    location: "🎧 Palco",
    day: "2025-06-19",
  },
  {
    id: 17,
    title: "Oficina de escalada noturna",
    startAt: "20:00 - 00:00",
    type: "workshop",
    location: "🧗 Climbchoose",
    day: "2025-06-19",
  },
  {
    id: 18,
    title: "Show de Reggae",
    instructor: "Jocilaine Oliveira e Apoena Ferreira",
    startAt: "21:00 - 23:00",
    location: "🎧 Palco",
    day: "2025-06-19",
  },

  // --- Sexta-feira: 2025-06-20 ---
  {
    id: 19,
    title: "Cerrado Trail: Veredas > Ponte de Pedra",
    startAt: "08:00",
    location: "🏞️ Cerrado Trail",
    day: "2025-06-20",
  },
  {
    id: 20,
    title: "Yoga",
    instructor: "Alice Amaral",
    startAt: "08:00 - 09:00",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-20",
  },
  {
    id: 21,
    title: "Finais do Speedline (Mata-mata)",
    startAt: "09:00 - 13:00",
    type: "competition",
    location: "🤸 Copa do Mundo de Highline",
    day: "2025-06-20",
  },
  {
    id: 22,
    title: "Semi-Finais do Freestyle (Masc/Fem)",
    startAt: "09:00 - 17:30",
    type: "competition",
    location: "🤸 Copa do Mundo de Highline",
    day: "2025-06-20",
  },
  {
    id: 23,
    title: "Highline Aberto ao Público",
    startAt: "09:00 - 17:30",
    type: "workshop",
    location: "🤸 Área de Highline",
    day: "2025-06-20",
  },
  {
    id: 24,
    title: "Pratique Movimento",
    startAt: "09:30 - 10:30",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-20",
  },
  {
    id: 25,
    title: "Corpos em Diálogo – Pontos de (des)equilíbrio em Duo",
    instructor: "Camila Ferreira",
    startAt: "11:00 - 12:00",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-20",
  },
  {
    id: 26,
    title: "Oficina de tecer mandalas em linhas",
    instructor: "Felipe Braga",
    startAt: "14:00 - 15:00",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-20",
  },
  {
    id: 27,
    title: "Massagem e yoga",
    instructor: "Laís Cacciari",
    startAt: "15:30 - 17:30",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-20",
  },
  {
    id: 28,
    title: "Forró nas Alturas",
    instructor: "João Manoel da Silva Parreira",
    startAt: "18:00 - 19:30",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-20",
  },
  {
    id: 29,
    title: "Oficina de escalada noturna",
    startAt: "20:00 - 00:00",
    type: "workshop",
    location: "🧗 Climbchoose",
    day: "2025-06-20",
  },
  {
    id: 30,
    title: "Oficina de Forró",
    instructor: "André Kenzo e Beatriz Furtado",
    startAt: "20:00 - 21:30",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-20",
  },
  {
    id: 31,
    title: "Selecta André Kenzo",
    startAt: "21:30 - 23:00",
    location: "🎧 Palco",
    day: "2025-06-20",
  },
  {
    id: 32,
    title: "DJ Set",
    startAt: "23:00 - 03:00",
    location: "🎧 Palco",
    day: "2025-06-20",
  },

  // --- Sábado: 2025-06-21 ---
  {
    id: 33,
    title: "Cerrado Trail: Veredas > Cachoeira Cozido",
    startAt: "08:00",
    location: "🏞️ Cerrado Trail",
    day: "2025-06-21",
  },
  {
    id: 34,
    title: "Yoga",
    instructor: "Bianca Machado",
    startAt: "08:00 - 09:00",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-21",
  },
  {
    id: 35,
    title: "Finais do Freestyle (Mata-mata)",
    startAt: "09:00 - 17:30",
    type: "competition",
    location: "🤸 Copa do Mundo de Highline",
    day: "2025-06-21",
  },
  {
    id: 36,
    title: "Highline Aberto ao Público",
    startAt: "09:00 - 17:30",
    type: "workshop",
    location: "🤸 Área de Highline",
    day: "2025-06-21",
  },
  {
    id: 37,
    title: "Elaboración de Sahumerios Artesanais & Yoga",
    instructor: "Verónica Daniela",
    startAt: "09:30 - 10:30",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-21",
  },
  {
    id: 38,
    title: "Crossfit Selva",
    instructor: "Wendy Lee e Ruggeri",
    startAt: "11:00 - 12:00",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-21",
  },
  {
    id: 39,
    title: "Kemetic Yoga",
    instructor: "Ismael Afonso",
    startAt: "15:00 - 16:00",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-21",
  },
  {
    id: 40,
    title: "Oficina de Perna de Pau",
    instructor: "Giulia Costa e Carol Rangel",
    startAt: "16:30 - 17:30",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-21",
  },
  {
    id: 41,
    title: "Oficina de Bambolê",
    instructor: "Voarte",
    startAt: "18:00 - 19:00",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-21",
  },
  {
    id: 42,
    title: "Oficina de Capoeira Angola + Roda",
    instructor: "Angoleiros do Sertão",
    startAt: "19:30 - 21:00",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-21",
  },
  {
    id: 43,
    title: "Cerimônia de Premiação e Rifa",
    startAt: "21:00 - 23:00",
    location: "🎪 Área de Convivência",
    day: "2025-06-21",
  },
  {
    id: 44,
    title: "Batalha de Rima",
    startAt: "23:00 - 00:00",
    type: "competition",
    location: "🎧 Palco",
    day: "2025-06-21",
  },
  {
    id: 45,
    title: "BAILE DO CHOOSE + Performances",
    instructor: "Coletivo Yabas, Boyzão",
    startAt: "00:00",
    location: "🎧 Palco",
    day: "2025-06-22", // Note: This starts at midnight, so it's technically Sunday
  },

  // --- Domingo: 2025-06-22 ---
  {
    id: 46,
    title: "Cerrado Trail: Veredas > Vale das Araras",
    startAt: "08:00",
    location: "🏞️ Cerrado Trail",
    day: "2025-06-22",
  },
  {
    id: 47,
    title: "Oficina Parada de Mão",
    instructor: "Luciana Casares",
    startAt: "08:00 - 09:00",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-22",
  },
  {
    id: 48,
    title: "Roda de conversa com atletas e integração",
    startAt: "09:00 - 10:00",
    location: "🤸 Copa do Mundo de Highline",
    day: "2025-06-22",
  },
  {
    id: 49,
    title: "Highline Aberto ao Público",
    startAt: "09:00 - 17:30",
    type: "workshop",
    location: "🤸 Área de Highline",
    day: "2025-06-22",
  },
  {
    id: 50,
    title: "Soundhealing",
    instructor: "Lotus Branca e Sara",
    startAt: "09:30 - 10:30",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-22",
  },
  {
    id: 51,
    title: "CHOOSE GAMES",
    startAt: "10:00 - 12:00",
    type: "competition",
    location: "🤸 Copa do Mundo de Highline",
    day: "2025-06-22",
  },
  {
    id: 52,
    title: "Oficina de Jiu Jitsu e defesa pessoal",
    instructor: "Gabriel Schardong",
    startAt: "11:00 - 12:30",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-22",
  },
  {
    id: 53,
    title: "Acrobacia em dupla/grupo",
    instructor: "Matheus Kamla",
    startAt: "14:00 - 15:00",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-22",
  },
  {
    id: 54,
    title: "Yoga & Sound Healing",
    instructor: "Bianca, Lotus Branca e Sara",
    startAt: "15:30 - 16:30",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-22",
  },
  {
    id: 55,
    title: "Oficina de Massagem e Automassagem",
    instructor: "Ariadne",
    startAt: "17:00 - 18:30",
    type: "workshop",
    location: "🎪 Área de Convivência",
    day: "2025-06-22",
  },
  {
    id: 56,
    title: "Cinema do Choose",
    startAt: "19:00 - 21:00",
    location: "🎪 Área de Convivência",
    day: "2025-06-22",
  },
];
