// simple class to represent a user
class User {
    constructor(userID, googleSub, name, email, paymentExpirationDate) {
        this.userID = userID;
        this.googleSub = googleSub;
        this.name = name;
        this.email = email;
        this.paymentExpirationDate = paymentExpirationDate;
    }

    static fromRow(row) {
        return new User(row.user_id, row.google_sub, row.name, row.email, row.payment_expiration_date);
    }

    validPayment() {
        return this.paymentExpirationDate > Date.now();
    }
}

export default User;