export type Role = "stratejist" | "supheci" | "yaratici" | "muhendis" | "realist";
export type MemberId = "athena" | "socrates" | "apollo" | "hephaestus" | "atlas" | "themis";

export interface Frame {
  raw_question: string;
  proposition: string;
  answer_format: "yes_no" | "choice" | "scalar";
  options: string[];
}

export interface MemberResponse {
  role: Role;
  stance: string;
  reasons: string[];
  confidence: number;
  flip_condition: string;
}

export interface Exchange {
  from: Role;
  targets: Role;
  claim_challenged: string;
  argument: string;
  objection: boolean;
  ruling: "upheld" | "overruled" | null;
  sub_round: string | null;
}

export interface Clash {
  fault_line: string;
  exchanges: Exchange[];
  upheld_count: number;
}

export interface VoteSignal {
  support: number;
  oppose: number;
}

export interface Verdict {
  decision: string;
  confidence: number;
  vote_signal: VoteSignal;
  confidence_weighted: string;
  dissenter: Role | null;
  dissent_is_load_bearing: boolean;
  consensus: string;
  fault_line: string;
  kill_condition: string;
  minority_report: string;
  open_questions: string[];
}

export type TrialEvent =
  | { type: "phase_started"; phase: "frame" | "opening" | "clash" | "verdict" }
  | { type: "frame"; data: Frame }
  | { type: "member_started"; member: MemberId }
  | { type: "member_response"; member: MemberId; data: MemberResponse }
  | { type: "clash"; data: Clash }
  | { type: "objection"; from: MemberId; target: MemberId; claim: string; ruling?: "upheld" | "overruled" }
  | { type: "verdict"; data: Verdict }
  | { type: "error"; message: string };
