/**
 * Shared SQL fragments.
 *
 * PRIVACY / DATA MINIMISATION: user-facing listings must never expose raw email
 * addresses. An email is personal data and a spam/phishing target — a freelancer
 * browsing tasks has no need to see the poster's address, only who they are.
 * This returns the user's chosen display name, falling back to the local part of
 * their email (the bit before "@") so there is always something to render for
 * accounts that never set a name.
 *
 * `alias` is the table alias to read from (e.g. 'users', 'client', 'freelancer').
 * It is NEVER user input — always a hardcoded alias chosen by the query author —
 * so interpolating it here cannot introduce SQL injection.
 */
function displayNameSql(alias, outputName) {
  return `COALESCE(NULLIF(${alias}.display_name, ''), split_part(${alias}.email, '@', 1)) as ${outputName}`;
}

module.exports = { displayNameSql };
