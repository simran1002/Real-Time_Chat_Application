const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { Schema } = mongoose;

const userSchema = new Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true }
});

// // Hash the password before saving to the database
// userSchema.pre('save', async function (next) {
//   const user = this;

//   // Only hash the password if it has been modified (or is new)
//   if (!user.isModified('password')) return next();

//   try {
//     const hashedPassword = await bcrypt.hash(user.password, 10);
//     user.password = hashedPassword;
//     next();
//   } catch (error) {
//     return next(error);
//   }
// });

// // Compare entered password with the hashed password in the database
// userSchema.methods.comparePassword = async function(candidatePassword) {
//   return bcrypt.compare(candidatePassword, this.password);
// };

const User = mongoose.model('User', userSchema);

module.exports = User;
