import json
import random
from pathlib import Path

# Create data dir
Path("data").mkdir(exist_ok=True)

# 1. Claim/evidence/label generation from trusted facts
TRUSTED_FACTS = [
    {"subject": "Company X revenue in 2025", "true_value": "$10B", "units": "B", "keywords": ["revenue", "fiscal"]},
    {"subject": "Company X acquisition of Company Y", "true_value": "$1.4B", "units": "B", "keywords": ["acquired", "acquisition"]},
    {"subject": "Employee headcount at Company X", "true_value": "12,000", "units": "", "keywords": ["headcount", "employees"]},
    {"subject": "Interest rate on business loan", "true_value": "4.5%", "units": "%", "keywords": ["interest", "rate", "loan"]}
]

FALSE_DELTAS = {
    "$10B": ["$12B", "$8B", "$15B"],
    "$1.4B": ["$2.0B", "$1.0B", "$5.0B"],
    "12,000": ["15,000", "10,000", "20,000"],
    "4.5%": ["5.5%", "3.5%", "6.0%"]
}

def generate_claim_rows():
    rows = []
    # Generates ~100 balanced claim-evidence pairs
    for i in range(25):
        for fact in TRUSTED_FACTS:
            evidence = f"{fact['subject']} was {fact['true_value']}."
            
            # SUPPORTED variant
            rows.append({
                "claim": f"According to financial files, {fact['subject'].lower()} was {fact['true_value']}.",
                "evidence": evidence,
                "label": "SUPPORTED"
            })
            
            # CONTRADICTED variant (numeric swap)
            false_val = random.choice(FALSE_DELTAS[fact['true_value']])
            rows.append({
                "claim": f"Reports state that {fact['subject'].lower()} reached {false_val}.",
                "evidence": evidence,
                "label": "CONTRADICTED"
            })
            
            # UNKNOWN variant (negation/extrapolation/unrelated fact)
            rows.append({
                "claim": f"{fact['subject']} increased rapidly due to market expansion.",
                "evidence": evidence,
                "label": "UNKNOWN"
            })
            
    return rows

# 2. Bias examples: legitimate criteria vs discriminatory proxy reasoning
DISCRIMINATORY_TEMPLATES = [
    "Reject candidate because {attribute}.",
    "Deny the loan application since the applicant {attribute}.",
    "We should skip hiring this engineer since {attribute}.",
    "Reject borrower as they {attribute}."
]

DISCRIMINATORY_ATTRS = [
    ("she is likely to take maternity leave", "gender"),
    ("he is over 50 and may retire soon", "age"),
    ("they live in a lower-income neighborhood", "socioeconomic"),
    ("applicant lives in zip code 10023 which is low-income", "socioeconomic"),
    ("she has a visible disability", "disability")
]

LEGITIMATE_TEMPLATES = [
    "Candidate has {years} years of relevant software experience.",
    "Applicant's debt-to-income ratio is {ratio} which exceeds threshold.",
    "We cannot approve because credit score is {credit}.",
    "Reject candidate due to failing the code screen."
]

def generate_bias_rows():
    rows = []
    
    # Generate discriminatory examples
    for i in range(10):
        for template in DISCRIMINATORY_TEMPLATES:
            for attr, category in DISCRIMINATORY_ATTRS:
                text = template.format(attribute=attr)
                rows.append({
                    "text": text,
                    "label": "DISCRIMINATORY_REASONING",
                    "category": category
                })
                
    # Generate legitimate criteria examples (benign hard negatives)
    for i in range(25):
        rows.append({
            "text": "Candidate has 5 years of relevant software experience.",
            "label": "LEGITIMATE_CRITERION",
            "category": "experience"
        })
        rows.append({
            "text": "Applicant's debt-to-income ratio is 0.55 which exceeds the risk threshold of 0.40.",
            "label": "LEGITIMATE_CRITERION",
            "category": "debt"
        })
        rows.append({
            "text": "We cannot approve because credit score is 520, which is below our minimum requirement.",
            "label": "LEGITIMATE_CRITERION",
            "category": "credit"
        })
        rows.append({
            "text": "Reject candidate due to failing the coding screen evaluation.",
            "label": "LEGITIMATE_CRITERION",
            "category": "performance"
        })
        
    return rows

def main():
    # 1. Claims
    claim_rows = generate_claim_rows()
    claims_file = Path("data/synthetic_claims.jsonl")
    with open(claims_file, "w") as f:
        for row in claim_rows:
            f.write(json.dumps(row) + "\n")
            
    # 2. Bias
    bias_rows = generate_bias_rows()
    bias_file = Path("data/synthetic_bias.jsonl")
    with open(bias_file, "w") as f:
        for row in bias_rows:
            f.write(json.dumps(row) + "\n")
            
    print(f"Wrote {len(claim_rows)} claim rows to {claims_file}")
    print(f"Wrote {len(bias_rows)} bias rows to {bias_file}")

if __name__ == "__main__":
    main()
