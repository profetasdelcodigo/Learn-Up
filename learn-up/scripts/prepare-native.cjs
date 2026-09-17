const { checkAndPreparePackage } = require("napi-postinstall");

checkAndPreparePackage("unrs-resolver", true).catch((error) => {
  console.error("Failed to prepare unrs-resolver:", error);
  process.exit(1);
});
