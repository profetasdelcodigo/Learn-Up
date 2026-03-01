async function fetchModels() {
  try {
    const res = await fetch(
      "https://learn-up-qmgx.onrender.com/api/test-models",
    );
    if (!res.ok) {
      console.log("Not ready yet or failed", res.status, res.statusText);
      return;
    }
    const data = await res.json();
    console.log("Vision Candidates:", data.vision_candidates);
  } catch (err) {
    console.log("Error fetching:", err);
  }
}
fetchModels();
