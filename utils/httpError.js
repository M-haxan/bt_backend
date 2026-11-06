// Creates an Error that carries its own HTTP status code.
// The error middleware reads err.statusCode, so controllers can simply:  throw httpError(400, 'message')
const httpError = (statusCode, message) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

module.exports = httpError;