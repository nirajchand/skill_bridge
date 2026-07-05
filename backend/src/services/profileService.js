function parseSkills(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // fall back to comma-separated
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function hasValue(v) {
  return v !== null && v !== undefined && String(v).trim() !== '';
}

// Weighted completion percentage per role.
function calcCompletion(user) {
  const skills = parseSkills(user.skills);
  if (user.role === 'freelancer') {
    let pct = 0;
    if (hasValue(user.display_name)) pct += 20;
    if (hasValue(user.bio)) pct += 20;
    if (hasValue(user.profile_image_url)) pct += 15;
    if (skills.length > 0) pct += 15;
    if (hasValue(user.location)) pct += 10;
    if (hasValue(user.hourly_rate)) pct += 10;
    if (hasValue(user.portfolio_url)) pct += 5;
    if (hasValue(user.cv_url)) pct += 5;
    return pct;
  }
  // client
  let pct = 0;
  if (hasValue(user.display_name)) pct += 25;
  if (hasValue(user.bio)) pct += 25;
  if (hasValue(user.profile_image_url)) pct += 25;
  if (hasValue(user.location)) pct += 25;
  return pct;
}

// Checklist of what is still missing (for the completion bar).
function completionChecklist(user) {
  const skills = parseSkills(user.skills);
  const base = [
    { key: 'display_name', label: 'Add a display name', done: hasValue(user.display_name) },
    { key: 'bio', label: 'Write a bio', done: hasValue(user.bio) },
    { key: 'profile_image_url', label: 'Upload a profile photo', done: hasValue(user.profile_image_url) },
    { key: 'location', label: 'Add your location', done: hasValue(user.location) }
  ];
  if (user.role === 'freelancer') {
    base.push(
      { key: 'skills', label: 'List your skills', done: skills.length > 0 },
      { key: 'hourly_rate', label: 'Set an hourly rate', done: hasValue(user.hourly_rate) },
      { key: 'portfolio_url', label: 'Add a portfolio link', done: hasValue(user.portfolio_url) },
      { key: 'cv_url', label: 'Upload your CV', done: hasValue(user.cv_url) }
    );
  }
  return base;
}

function displayNameOf(user) {
  return user.display_name || user.email.split('@')[0];
}

// Full profile for the owner (includes email + completion detail).
function privateProfile(user, extra = {}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    display_name: displayNameOf(user),
    profile_image_url: user.profile_image_url || null,
    bio: user.bio || null,
    location: user.location || null,
    skills: parseSkills(user.skills),
    hourly_rate: user.hourly_rate || null,
    portfolio_url: user.portfolio_url || null,
    cv_url: user.cv_url || null,
    company_name: user.company_name || null,
    company_website: user.company_website || null,
    is_verified: !!user.is_verified,
    profile_completion_percentage: calcCompletion(user),
    profile_completed: calcCompletion(user) >= 100,
    checklist: completionChecklist(user),
    ...extra
  };
}

// Public profile (no email).
function publicProfile(user, extra = {}) {
  return {
    id: user.id,
    role: user.role,
    display_name: displayNameOf(user),
    profile_image_url: user.profile_image_url || null,
    bio: user.bio || null,
    location: user.location || null,
    skills: parseSkills(user.skills),
    hourly_rate: user.hourly_rate || null,
    portfolio_url: user.portfolio_url || null,
    cv_url: user.cv_url || null,
    company_name: user.company_name || null,
    company_website: user.company_website || null,
    is_verified: !!user.is_verified,
    ...extra
  };
}

module.exports = {
  parseSkills,
  calcCompletion,
  completionChecklist,
  privateProfile,
  publicProfile,
  displayNameOf
};
