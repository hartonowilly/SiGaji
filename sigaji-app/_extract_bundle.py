# One-off / utility: extracts bundle from ../sigaji_cursor.html
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
html_path = root / "sigaji_cursor.html"
html = html_path.read_text(encoding="utf-8")
lines = html.splitlines()


def get(a: int, b: int) -> str:
    return "\n".join(lines[a - 1 : b]) + "\n"


app_dir = pathlib.Path(__file__).resolve().parent
(app_dir / "css").mkdir(parents=True, exist_ok=True)
(app_dir / "js").mkdir(parents=True, exist_ok=True)

(app_dir / "css" / "styles.css").write_text(get(8, 177), encoding="utf-8")

const_a = get(944, 948) + get(952, 982)
ter = get(1074, 1078)
(app_dir / "js" / "constants.js").write_text(const_a + ter + "const SCHEMA_VERSION=2;\n", encoding="utf-8")

(app_dir / "js" / "ptkp.js").write_text(get(949, 951), encoding="utf-8")

storage_head = """function migrateStorage(db){
  if(!db||typeof db!=='object')return db;
  var v=db.schemaVersion|0;
  if(v<2){
    db.perusahaan=db.perusahaan||{};
    if(db.perusahaan.ptkp_nilai===undefined)db.perusahaan.ptkp_nilai={};
    v=2;
  }
  db.schemaVersion=v;
  return db;
}
"""

block = get(983, 1021)
old_load = """function dbLoad(){
  try{
    const raw=localStorage.getItem(DB_KEY);
    if(!raw)return null;
    return JSON.parse(raw);
  }catch(e){
    console.error('dbLoad error - clearing corrupt data:',e);
    localStorage.removeItem(DB_KEY);
    return null;
  }
}
function dbSave(o){try{localStorage.setItem(DB_KEY,JSON.stringify(o));showSI();}catch{}}"""

new_load = """function dbLoad(){
  try{
    const raw=localStorage.getItem(DB_KEY);
    if(!raw)return null;
    let db=JSON.parse(raw);
    const snap=JSON.stringify(db);
    db=migrateStorage(db);
    if(JSON.stringify(db)!==snap){
      try{localStorage.setItem(DB_KEY,JSON.stringify(db));}catch(e){}
    }
    return db;
  }catch(e){
    console.error('dbLoad error - clearing corrupt data:',e);
    localStorage.removeItem(DB_KEY);
    return null;
  }
}
function dbSave(o){
  try{
    const payload=Object.assign({schemaVersion:SCHEMA_VERSION},o);
    localStorage.setItem(DB_KEY,JSON.stringify(payload));
    showSI();
  }catch(e){}
}"""

if old_load not in block:
    raise SystemExit("dbLoad block mismatch — update extractor")

block = block.replace(old_load, new_load)
(app_dir / "js" / "storage.js").write_text(storage_head + block, encoding="utf-8")

app_body = get(1022, 1070) + get(1079, 2388)
(app_dir / "js" / "app.js").write_text(app_body, encoding="utf-8")

head = "\n".join(lines[0:6]) + '\n<link rel="stylesheet" href="css/styles.css">\n'
body = get(179, 941)
scripts = """<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="js/constants.js"></script>
<script src="js/storage.js"></script>
<script src="js/ptkp.js"></script>
<script src="js/app.js"></script>
"""
(app_dir / "index.html").write_text(head + body + scripts + "</body>\n</html>\n", encoding="utf-8")

print("Written to", app_dir)
