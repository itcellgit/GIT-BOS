// Expected errors. The request handler turns these into friendly JSON responses;
// anything else is logged and reported as an unexpected error.

/** A problem the user can fix (wrong input, a rule not met). Optional per-field messages. */
export class UserError extends Error {
  /**
   * @param {string} message
   * @param {Record<string, string>} [fieldErrors]
   */
  constructor(message, fieldErrors) {
    super(message);
    this.name = "UserError";
    this.fieldErrors = fieldErrors;
  }
}

/** The signed-in user is missing (401), or lacks the permission for this action (403). */
export class PermissionError extends Error {
  constructor(message = "You do not have permission to do this.", status = 403, code = undefined) {
    super(message);
    this.name = "PermissionError";
    this.status = status;
    this.code = code;
  }
}

/** The requested record does not exist (404). */
export class NotFoundError extends Error {
  constructor(message = "Not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Someone else changed the record first (409). `latest` lets the client offer the newer copy. */
export class ConflictError extends Error {
  constructor(message, latest) {
    super(message);
    this.name = "ConflictError";
    this.latest = latest;
  }
}
