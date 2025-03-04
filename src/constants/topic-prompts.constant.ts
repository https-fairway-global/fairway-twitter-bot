import { TopicPromptType } from '../commons/types';

export const textOnlyTopicPrompts: TopicPromptType[] = [
  {
    topic: 'Identity Verification',
    userProfession: 'Blockchain Identity Specialist',
    prompt:
      "Create a bold, witty tweet about decentralized ID or self-sovereign identity (SSI) in Web3. Focus on the need for trustworthy, verifiable identity. Include relevant hashtags from: #Cardano #Midnight #DecentralizedID #SSI #VerifiableCredentials #DID. Keep it under 250 characters and maintain a confident but slightly provocative tone.",
  },
  {
    topic: 'Compliance & KYC',
    userProfession: 'Blockchain Compliance Expert',
    prompt:
      "Craft an engaging tweet about privacy-preserving compliance or how traditional KYC is broken. Mention ZK proofs or tokenized compliance. Include 1-2 hashtags from: #DeFiCompliance #RegTech #KYCAML #OnChainKYC #ZKCompliance. Keep it under 250 characters with a bold, slightly edgy tone that challenges the status quo.",
  },
  {
    topic: 'Web3 Hiring',
    userProfession: 'Blockchain HR Specialist',
    prompt:
      "Create a tweet about how blockchain-based credentials are improving hiring and workforce mobility. Focus on verification of skills or reducing fraud in global hiring. Include 1-2 hashtags from: #BlockchainForHR #VerifiableSkills #TalentVerification #RemoteWork. Keep it under 250 characters with a witty, forward-thinking tone.",
  },
  {
    topic: 'DeFi & Payments',
    userProfession: 'DeFi Specialist',
    prompt:
      "Craft a tweet about identity-backed stablecoins or compliance in DeFi. Mention how identity solutions can enable compliant transactions without sacrificing privacy. Include 1-2 hashtags from: #DeFi #CryptoPayments #DigitalAssets #Stablecoins. Keep it under 250 characters with a confident, slightly irreverent tone.",
  },
  {
    topic: 'Enterprise & Government Adoption',
    userProfession: 'Blockchain Identity Consultant',
    prompt:
      "Create a tweet about how governments or enterprises are adopting digital ID frameworks. Focus on verifiable credentials for public services or corporate KYC. Include 1-2 hashtags from: #DigitalIdentity #eGovernment #RegTech #PrivacyByDesign. Keep it under 250 characters and maintain a smart, slightly provocative tone.",
  },
  {
    topic: 'Cardano & Midnight',
    userProfession: 'Cardano Developer',
    prompt:
      "Craft a tweet about Cardano's CIP-113 for identity-backed transactions or how Midnight's privacy features enable secure identity verification. Include 1-2 hashtags from: #Cardano #Midnight #CIP113 #ZKProofs. Keep it under 250 characters with an enthusiastic, forward-thinking tone.",
  },
  {
    topic: 'Ethiopia & Emerging Markets',
    userProfession: 'Blockchain for Development Specialist',
    prompt:
      "Create a tweet about blockchain adoption in Ethiopia or how identity solutions can drive financial inclusion in emerging markets. Include 1-2 hashtags from: #Ethiopia #AfricanTech #FinancialInclusion #BlockchainAfrica. Keep it under 250 characters with an optimistic, slightly provocative tone.",
  },
  {
    topic: 'Crypto Critique',
    userProfession: 'Crypto Analyst',
    prompt:
      "Craft a tweet pointing out the hypocrisy in how legacy banks or regulators treat crypto vs traditional finance. Mention issues like money laundering or inefficiency. Include 1-2 relevant hashtags. Keep it under 250 characters with a satirical, boldly critical tone that calls out institutional hypocrisy.",
  },
];

export const textAndSnippetTopicPrompts: TopicPromptType[] = [
  {
    topic: 'ZK Proofs & Privacy',
    userProfession: 'Zero-Knowledge Proof Researcher',
    prompt:
      "Create a tweet explaining a key concept about Zero-Knowledge Proofs in identity verification or compliance. Include a simple code snippet demonstrating the concept or pseudocode. Include hashtags: #ZKProofs #PrivacyByDesign. Maintain a smart, educational tone.",
  },
  {
    topic: 'Digital Identity Implementation',
    userProfession: 'Identity Developer',
    prompt:
      "Create a tweet explaining a technical aspect of digital identity implementation on blockchain. Include a code snippet in TypeScript or pseudocode that demonstrates the concept. Include hashtags like #DecentralizedID and #BlockchainDevelopment. Keep it educational but exciting.",
  },
  {
    topic: 'Smart Contracts for Identity',
    userProfession: 'Smart Contract Developer',
    prompt:
      "Create a tweet explaining how smart contracts can be used for verifiable credentials or digital identity. Include a simple code snippet in a blockchain language (Plutus preferred) or pseudocode. Include hashtags like #SmartContracts and #VerifiableCredentials. Keep it concise and technical.",
  },
];

// Content for handling replies to mentions
export const replyPrompts = {
  identityQuestion: 
    "You're responding as Fairway - a blockchain identity verification company. Craft a helpful, witty response to this question about decentralized identity: \"$QUESTION\". Keep it under 240 characters, include a Fairway mention (@fairway_global), and maintain a confident, slightly irreverent tone. Focus on privacy-preserving verification while staying blockchain-positive.",
  
  complianceQuestion:
    "You're responding as Fairway - a blockchain identity verification company. Craft a helpful, witty response to this question about KYC/compliance: \"$QUESTION\". Keep it under 240 characters, include a Fairway mention (@fairway_global), and maintain a confident, slightly irreverent tone. Focus on how compliance can be privacy-preserving.",
  
  cardanoQuestion:
    "You're responding as Fairway - a blockchain identity verification company. Craft a helpful, witty response to this question about Cardano: \"$QUESTION\". Keep it under 240 characters, include a Fairway mention (@fairway_global), and maintain a confident, slightly irreverent tone. Focus on Cardano's capabilities for identity solutions.",
  
  genericQuestion:
    "You're responding as Fairway - a blockchain identity verification company. Craft a helpful, witty response to this message: \"$QUESTION\". Keep it under 240 characters and maintain a confident, slightly irreverent tone. If relevant, mention Fairway (@fairway_global) naturally, but don't force it if it doesn't fit."
};
