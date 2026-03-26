/**
 * Generates a short, unambiguous access code in the format XXXX-XXXX.
 * Excludes characters that look similar: 0/O, 1/I/L.
 */
const CHARSET = "2345679ABCDEFGHJKMNPQRSTUVWXYZ";

function randomChar(): string {
  return CHARSET[Math.floor(Math.random() * CHARSET.length)];
}

export function generateAccessCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += randomChar();
  code += "-";
  for (let i = 0; i < 4; i++) code += randomChar();
  return code;
}
