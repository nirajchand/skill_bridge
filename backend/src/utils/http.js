function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data, error: null });
}

function fail(res, error, status = 400) {
  return res.status(status).json({ success: false, data: null, error });
}

module.exports = { ok, fail };
