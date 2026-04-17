const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    const authHeader = req.header("Authorization");
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;

    if (!token) {
        return res.status(401).json({ message: "No token, authorization denied" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = decoded.id;
        next();
    } catch (err) {
        res.status(401).json({ message: "Token is not valid" });
    }
};