// Turns user text into a safe regex pattern: "(" becomes "\(" so it is treated as plain text.
// Without this, typing a special character in a search box can crash the server or freeze it (ReDoS).
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = escapeRegex;