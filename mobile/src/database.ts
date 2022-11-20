export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Highline {
  id: string;
  name: string;
  length: number;
  height: number;
  anchorA: Coordinates;
  anchorB: Coordinates;
  isRigged: boolean;
}

interface Database {
  highline: Highline[];
}

const database: Database = {
  highline: [
    {
      id: '1',
      name: 'Pangaré Figueiredo',
      height: 15,
      length: 42,
      anchorA: { latitude: -15.782699598577715, longitude: -47.93240706636002 },
      anchorB: { latitude: -15.782857045014248, longitude: -47.932031557107194 },
      isRigged: false,
    },
    {
      id: '2',
      name: 'Varal de Cabaré',
      height: 24,
      length: 84,
      anchorA: { latitude: -16.40110401623181, longitude: -48.98699219976841 },
      anchorB: { latitude: -16.39990690739436, longitude: -48.98303872861332 },
      isRigged: true,
    },
    {
      id: '3',
      name: 'Conexão solar',
      height: 14,
      length: 102,
      anchorA: { latitude: -15.778183566169623, longitude: -47.931543132850656 },
      anchorB: { latitude: -15.778931875114475, longitude: -47.93199831884097 },
      isRigged: true,
    },
    {
      id: '4',
      name: 'Lifelândia',
      height: 17,
      length: 92,
      anchorA: { latitude: -15.80461103360696, longitude: -47.9267950975197 },
      anchorB: { latitude: -15.804919876501172, longitude: -47.927278408212295 },
      isRigged: false,
    },
  ],
};

export default database;
