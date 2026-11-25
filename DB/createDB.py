import duckdb
import io
import os
from pathlib import Path
import requests
import tempfile
import zipfile

# -------------------------------------------------------------------------
# Étape 1 : Récupérer l'URL du dernier export GDELT
# -------------------------------------------------------------------------
print("Récupération de la dernière URL GDELT...")
last_update_resp = requests.get("http://data.gdeltproject.org/gdeltv2/lastupdate.txt")
lines = last_update_resp.text.strip().split("\n")
export_url = [line.split()[-1] for line in lines if "export.CSV.zip" in line][0]
print(f"Archive ciblée : {export_url}")

# -------------------------------------------------------------------------
# Étape 2 : Connexion DuckDB (fichier local persistant)
# -------------------------------------------------------------------------
con = duckdb.connect("gdelt_analytics.duckdb")

# -------------------------------------------------------------------------
# Étape 3 : Définition des colonnes officielles de GDELT 2.0
# -------------------------------------------------------------------------
gdelt_columns = [
    # 0 à 4 : Identifiants & Date
    "GlobalEventID", "Day", "MonthYear", "Year", "FractionDate",
    
    # 5 à 14 : Acteur 1 (Initiateur)
    "Actor1Code", "Actor1Name", "Actor1CountryCode", "Actor1KnownGroupCode", 
    "Actor1EthnicCode", "Actor1Religion1Code", "Actor1Religion2Code", 
    "Actor1Type1Code", "Actor1Type2Code", "Actor1Type3Code",
    
    # 15 à 24 : Acteur 2 (Cible)
    "Actor2Code", "Actor2Name", "Actor2CountryCode", "Actor2KnownGroupCode", 
    "Actor2EthnicCode", "Actor2Religion1Code", "Actor2Religion2Code", 
    "Actor2Type1Code", "Actor2Type2Code", "Actor2Type3Code",
    
    # 25 à 34 : Action (Nomenclature CAMEO & Évaluations)
    "IsRootEvent", "EventCode", "EventBaseCode", "EventRootCode", 
    "QuadClass", "GoldsteinScale", "NumMentions", "NumSources", 
    "NumArticles", "AvgTone",
    
    # 35 à 42 : Géographie Acteur 1
    "Actor1Geo_Type", "Actor1Geo_FullName", "Actor1Geo_CountryCode", 
    "Actor1Geo_ADM1Code", "Actor1Geo_ADM2Code", "Actor1Geo_Lat", 
    "Actor1Geo_Long", "Actor1Geo_FeatureID",
    
    # 43 à 50 : Géographie Acteur 2
    "Actor2Geo_Type", "Actor2Geo_FullName", "Actor2Geo_CountryCode", 
    "Actor2Geo_ADM1Code", "Actor2Geo_ADM2Code", "Actor2Geo_Lat", 
    "Actor2Geo_Long", "Actor2Geo_FeatureID",
    
    # 51 à 58 : Géographie du lieu de l'Action & Méta
    "ActionGeo_Type", "ActionGeo_FullName", "ActionGeo_CountryCode", 
    "ActionGeo_ADM1Code", "ActionGeo_ADM2Code", "ActionGeo_Lat", 
    "ActionGeo_Long", "ActionGeo_FeatureID",
    
    # 59 (Optionnel selon versions V2) : Date d'ajout et URL source
    "DATEADDED", "SOURCEURL"
]

# -------------------------------------------------------------------------
# Étape 4 : Création du schéma de la table de faits puis chargement incrémental
# -------------------------------------------------------------------------
print("Téléchargement et ajout des nouveaux événements GDELT en cours...")
col_names_str = ", ".join([f"'{c}'" for c in gdelt_columns])
column_defs_str = ", ".join([f"{c} VARCHAR" for c in gdelt_columns])

con.execute(f"""
    CREATE TABLE IF NOT EXISTS fact_gdelt_events (
        {column_defs_str}
    );
""")

archive_resp = requests.get(export_url)
archive_resp.raise_for_status()

with zipfile.ZipFile(io.BytesIO(archive_resp.content)) as archive:
    csv_members = [name for name in archive.namelist() if name.endswith(".CSV")]
    if len(csv_members) != 1:
        raise RuntimeError(f"Archive GDELT inattendue: {csv_members}")

    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as csv_file:
        csv_file.write(archive.read(csv_members[0]))
        csv_path = csv_file.name

try:
    con.execute(f"""
        INSERT INTO fact_gdelt_events
        SELECT *
        FROM read_csv(
            '{csv_path}',
            delim='\t',
            header=False,
            names=[{col_names_str}],
            all_varchar=True
        )
        WHERE GlobalEventID IS NOT NULL
          AND GlobalEventID NOT IN (
              SELECT GlobalEventID
              FROM fact_gdelt_events
          );
    """)
finally:
    os.remove(csv_path)

count_facts = con.execute("SELECT COUNT(*) FROM fact_gdelt_events").fetchone()[0]
print(f"Lignes de faits présentes dans la table : {count_facts}")

# -------------------------------------------------------------------------
# Étape 5 : Création des tables dimensionnelles et de faits
# -------------------------------------------------------------------------
cameo_path = Path("CAMEO.eventcodes.txt").resolve().as_posix()

con.execute(f"""
    CREATE OR REPLACE TABLE dim_event_codes AS
    SELECT
        CAMEOEVENTCODE AS EventCode,
        EVENTDESCRIPTION AS EventDescription
    FROM read_csv(
        '{cameo_path}',
        delim='\t',
        header=True,
        columns={{
            'CAMEOEVENTCODE': 'VARCHAR',
            'EVENTDESCRIPTION': 'VARCHAR'
        }}
    );
""")

count_codes = con.execute("SELECT COUNT(*) FROM dim_event_codes").fetchone()[0]
count_unmatched = con.execute("""
    SELECT COUNT(*)
    FROM fact_gdelt_events AS fact
    LEFT JOIN dim_event_codes AS dim USING (EventCode)
    WHERE dim.EventCode IS NULL
      AND fact.EventCode IS NOT NULL
""").fetchone()[0]

print(f"Codes CAMEO chargés : {count_codes}")
print(f"Codes d'événements sans correspondance : {count_unmatched}")

country_path = Path("CAMEO.country.txt").resolve().as_posix()
con.execute(f"""
    CREATE OR REPLACE TABLE dim_countries AS
    SELECT
        CODE AS CountryCode,
        LABEL AS CountryLabel
    FROM read_csv(
        '{country_path}',
        delim='\t',
        header=True,
        columns={{
            'CODE': 'VARCHAR',
            'LABEL': 'VARCHAR'
        }}
    );
""")

country_count = con.execute("SELECT COUNT(*) FROM dim_countries").fetchone()[0]
print(f"Pays CAMEO chargés : {country_count}")

query = """
SELECT
    d.CountryLabel,
    COUNT(*) AS nb_mentions
FROM (
    SELECT Actor1CountryCode AS CountryCode
    FROM fact_gdelt_events
    WHERE Actor1CountryCode IS NOT NULL
      AND Actor1CountryCode <> ''

    UNION ALL

    SELECT Actor2CountryCode AS CountryCode
    FROM fact_gdelt_events
    WHERE Actor2CountryCode IS NOT NULL
      AND Actor2CountryCode <> ''
) t
JOIN dim_countries d
  ON d.CountryCode = t.CountryCode
GROUP BY d.CountryCode, d.CountryLabel
ORDER BY nb_mentions DESC
LIMIT 5;
"""

print(con.execute(query).fetchdf())


query = """
SELECT
    d.EventCode,
    d.EventDescription,
    COUNT(*) AS nb_occurrences
FROM fact_gdelt_events f
JOIN dim_event_codes d
  ON d.EventCode = f.EventCode
WHERE f.EventCode IS NOT NULL
  AND f.EventCode <> ''
GROUP BY d.EventCode, d.EventDescription
ORDER BY nb_occurrences DESC
LIMIT 10;
"""

print(con.execute(query).fetchdf())