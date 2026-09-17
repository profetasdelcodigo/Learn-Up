// Temporary production hardening for AI-generated exams.
// Some providers have returned malformed section objects like:
// },"Sección II","questions",":",[ ... ]
// Normalize only strings that clearly look like this exam payload before JSON.parse.
const nativeParse = JSON.parse;

JSON.parse = function patchedJSONParse(value, reviver) {
  if (typeof value === "string" && value.includes('"sections"') && /},\s*"[^"]+"\s*,\s*"questions"\s*,\s*":"\s*,\s*\[/.test(value)) {
    value = value.replace(
      /},\s*"([^"]+)"\s*,\s*"questions"\s*,\s*":"\s*,\s*\[/g,
      '},{"title":"$1","questions":['
    );
  }

  return nativeParse.call(JSON, value, reviver);
};
