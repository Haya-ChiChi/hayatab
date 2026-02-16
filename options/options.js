const input = document.getElementById("api-key");
const btnSave = document.getElementById("btn-save");
const status = document.getElementById("status");

function maskKey(key) {
  if (!key || key.length < 12) return "****";
  return key.slice(0, 7) + "..." + key.slice(-4);
}

async function loadKey() {
  const { apiKey } = await browser.storage.local.get("apiKey");
  if (apiKey) {
    input.placeholder = maskKey(apiKey);
  }
}

btnSave.addEventListener("click", async () => {
  const value = input.value.trim();
  if (!value) {
    status.textContent = "Please enter a key.";
    status.className = "status error";
    return;
  }

  await browser.storage.local.set({ apiKey: value });
  input.value = "";
  input.placeholder = maskKey(value);
  status.textContent = "Saved!";
  status.className = "status success";
  setTimeout(() => (status.textContent = ""), 2000);
});

loadKey();
