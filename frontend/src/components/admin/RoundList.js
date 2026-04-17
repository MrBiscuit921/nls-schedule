import {useEffect, useState} from "react";
import axios from "axios";
import {Link, useNavigate} from "react-router-dom";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export default function RoundList() {
  const [rounds, setRounds] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      navigate("/admin/login");
    } else fetchRounds();
  }, [navigate]);

  const fetchRounds = async () => {
    const token = localStorage.getItem("adminToken");
    const config = {headers: {Authorization: `Bearer ${token}`}};
    try {
      const res = await axios.get(`${API_URL}/rounds`, config);
      setRounds(res.data);
    } catch (err) {
      console.error("Error fetching rounds:", err);
    }
  };

  const deleteRound = async (id) => {
    if (!window.confirm("Are you sure you want to delete this round?")) return;
    const token = localStorage.getItem("adminToken");
    try {
      await axios.delete(`${API_URL}/rounds/${id}`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      fetchRounds();
    } catch (err) {
      alert("Error deleting round:", err);
    }
  };

  return (
    <div style={{padding: "2rem"}}>
      <div style={{display: "flex", justifyContent: "space-between"}}>
        <h1>Manage Rounds</h1>
        <Link
          to="/admin/round/new"
          style={{
            padding: "0.5rem 1rem",
            background: "#1e1e2f",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
          }}>
          + New Round
        </Link>
      </div>
      <table
        style={{width: "100%", borderCollapse: "collapse", marginTop: "1rem"}}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Short Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.name}</td>
              <td>{r.shortDate}</td>
              <td className="table-actions">
                <Link to={`/admin/round/${r.id}/edit`}>
                  <button className="btn btn-primary btn-sm">Edit</button>
                </Link>
                <button
                  onClick={() => deleteRound(r.id)}
                  className="btn btn-danger btn-sm">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
