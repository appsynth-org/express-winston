const KEYS = [
  // generic
  /passw(or)?d/i,
  /^pw$/,
  /^pass$/i,
  /secret/i,
  /token/i,
  /api[-._]?key/i,
  /session[-._]?id/i,

  // specific
  /^connect\.sid$/, // https://github.com/expressjs/session
];

const VALUES = [
  /^\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}$/, // credit card number
];

function key(str: any) {
  return KEYS.some(function (regex) {
    return regex.test(str);
  });
}

function value(str: any) {
  return VALUES.some(function (regex) {
    return typeof str === 'string' ? regex.test(str) : false;
  });
}

export default {
  key,
  value,
};
