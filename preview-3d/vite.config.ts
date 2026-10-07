import {defineConfig} from "vite";
import {fileURLToPath} from "node:url";
export default defineConfig({
 base:"./",
 resolve:{alias:{"@":fileURLToPath(new URL("../",import.meta.url))}},
 server:{port:5174,strictPort:true,fs:{allow:[fileURLToPath(new URL("../",import.meta.url))]}}
});
