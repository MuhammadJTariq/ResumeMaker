const crypto = require("crypto");
const Database = require("./db");

class Registration {
  constructor(firstName, lastName, email, address, password, profession = null, phoneNumber = null) {
    this.firstName = firstName ? String(firstName).trim() : "";
    this.lastName = lastName ? String(lastName).trim() : "";
    this.email = email ? String(email).trim() : "";
    this.address = address ? String(address).trim() : "";
    this.password = password ? String(password) : "";
    this.profession = profession ? String(profession).trim() : null;
    this.phoneNumber = phoneNumber ? String(phoneNumber).trim() : null;
    this.userId = null;
    this.passwordHash = null;
  }

  validate() {
    if (!this.firstName || !this.lastName || !this.email || !this.address || !this.password) {
      throw new Error("First name, last name, email, address, and password are required.");
    }

    if (this.password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
  }

  createPasswordHash() {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(this.password, salt, 64).toString("hex");
    this.passwordHash = `${salt}:${hash}`;
  }

  static verifyPassword(password, passwordHash) {
    if (!passwordHash || !passwordHash.includes(":")) {
      return false;
    }

    const [salt, storedHash] = passwordHash.split(":");
    const computedHash = crypto.scryptSync(String(password), salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(storedHash, "hex"), Buffer.from(computedHash, "hex"));
  }

  toDTO() {
    return {
      userId: this.userId,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      address: this.address,
      profession: this.profession,
      phoneNumber: this.phoneNumber,
    };
  }

  async save() {
    this.validate();
    this.userId = crypto.randomUUID();
    this.createPasswordHash();

    const db = Database.getInstance();
    await db.run({
      table: "UserINFO",
      action: "INSERT",
      data: {
        user_id: this.userId,
        first_name: this.firstName,
        last_name: this.lastName,
        email: this.email,
        address: this.address,
        password_hash: this.passwordHash,
        profession: this.profession,
        phone_number: this.phoneNumber,
      },
    });

    await db.run({
      table: "users",
      action: "INSERT",
      data: {
        id: this.userId,
        name: `${this.firstName} ${this.lastName}`.trim(),
        profile: this.profession || "ResumeMaker user",
        address: this.address,
        subscription: "Free",
        account_status: "Active",
      },
    });

    return this.toDTO();
  }
}

module.exports = Registration;
