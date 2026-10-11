export function padTwoDigits(value: number | string) {
  return String(value).padStart(2, "0");
}

export function uppercaseText(value: string) {
  return value.toUpperCase();
}

export function capitalizeText(value: string) {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}
