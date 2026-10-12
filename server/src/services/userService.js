const userRepository = require('../repositories/userRepository');

// Partial profile update using dot-paths so untouched profile fields are preserved.
async function updateProfile(user, { name, profile }) {
  const $set = {};
  if (name) $set.name = name;
  Object.entries(profile || {}).forEach(([k, v]) => {
    $set[`profile.${k}`] = v;
  });
  await userRepository.updateById(user._id, { $set });
  return (await userRepository.findById(user._id)).toSafeJSON();
}

module.exports = { updateProfile };
