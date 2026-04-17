import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export default function AdminLogin() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const res = await axios.post(`${API_URL}/admin/login`, { username, password });
            localStorage.setItem("adminToken", res.data.token);
            navigate("/admin");
        } catch (err) {
            setError("Invalid credentials");
        }
    };

    return (
        <div style={{ maxWidth: "400px", margin: "2rem auto", padding: "2rem", border: "1px solid #ccc", borderRadius: "8px" }}>
            <h2>Admin Login</h2>
            {error && <p style={{ color: "red" }}>{error}</p>}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <input
                    type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required style={{ width: "100%", marginBottom: "1rem", padding: "0.5rem" }} />
                <input
                    type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: "100%", marginBottom: "1rem", padding: "0.5rem" }} />
                <button type="submit" style={{ padding: "0.5rem", background: "#1e1e2f", color: "white", border: "none", cursor: "pointer" }}>
                    Login
                </button>
            </form>

        </div>
    );
}