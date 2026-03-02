/** Class A → Class H share conversion mechanics */
import { ShareConversionResult } from './types';

export function calculateShareConversion(
  fundsRaised: number,
  loanAmount: number,
  programFeePct: number = 0.05,
  conversionPrice: number = 1.00
): ShareConversionResult {
  const classASharePrice = conversionPrice * (1 + programFeePct); // $1.05
  const classASharesIssued = Math.floor(fundsRaised / classASharePrice);

  const loanProgramFee = loanAmount * programFeePct;
  const classHUnitsIssued = loanAmount / conversionPrice;
  
  // Calculate missing fields for reports
  const pricePerShare = classASharePrice;
  const netToDeploy = fundsRaised - (classASharesIssued * classASharePrice);

  return {
    fundsRaised,
    conversionPrice,
    programFeePct,
    classASharePrice,
    classASharesIssued,
    loanAmount,
    classHUnitsIssued,
    investorPnL: -loanProgramFee,
    portfolioClassHUnits: classASharesIssued,
    portfolioInvestorPnL: -(fundsRaised - classASharesIssued * conversionPrice),
    // Report fields
    pricePerShare,
    netToDeploy,
  };
}
