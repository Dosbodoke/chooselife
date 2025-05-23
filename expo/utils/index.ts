export const calculateZoomLevel = (latitudeDelta: number): number => {
  return Math.round(Math.log2(360 / latitudeDelta));
};

export function transformTimeStringToSeconds(timeString: string): number {
  const [minutes, seconds] = timeString.split(":").map(Number);
  const totalSeconds = minutes * 60 + seconds;
  return totalSeconds;
}

export function transformSecondsToTimeString(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeString = `${padZero(minutes)}:${padZero(seconds)}`;
  return timeString;
}

function padZero(num: number): string {
  return num.toString().padStart(2, "0");
}

export function date18YearsAgo() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 18);
  return date.toISOString().split("T")[0];
}
