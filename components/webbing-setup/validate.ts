import { WebType } from "~/app/highline/[id]/rig";
import { WebbingSchema } from "../webbing-input";

export const validateSectionLoops = ({
    webbings,
    type,
    highlineLength,
  }: {
    webbings: WebbingSchema[];
    type: WebType;
    highlineLength: number;
  }): string | undefined => {
    const totalLength = webbings.reduce(
      (acc, curr) => acc + Number(curr.length),
      0,
    );
  
    // Validate that section is longer than highline
    if (totalLength <= highlineLength) {
      return `Comprimento total da fita ${type === 'main' ? 'principal' : 'backup'} deve ser maior que o highline.`;
    }
  
    // Create error message variable that will hold any error raised inside forEach
    let errorMessage: string | undefined = undefined;
    webbings.forEach((webbing, index, array) => {
      if (errorMessage) return;
  
      // If is single line, it doesn't need loops (will be connected directly to the web lock)
      const isSingle = array.length === 1;
      if (isSingle) return;
  
      const isFirst = index === 0;
      const isLast = index === array.length - 1;
  
      // First and last sections must have at least one loop
      if (isFirst || isLast) {
        if (!webbing.leftLoop && !webbing.rightLoop) {
          errorMessage = `Seção #${index + 1} deve ter pelo menos um olhal para fazer conexão.`;
        }
        return;
      }
  
      // Middle sections must have both loops
      if (!webbing.leftLoop || !webbing.rightLoop) {
        errorMessage = `Seção #${index + 1} deve ter os dois olhais para fazer conexão.`;
        return;
      }
    });
  
    return errorMessage;
  };
  
  export const validateConnections = ({
    main,
    backup,
  }: {
    main: WebbingSchema[];
    backup: WebbingSchema[];
  }) => {
    let error: string | undefined = undefined;
    // Calculate cumulative lengths for main line
    const mainCumulative = main.reduce<number[]>((acc, curr) => {
      const prev = acc[acc.length - 1] || 0;
      return [...acc, prev + Number(curr.length)];
    }, []);
  
    // Calculate cumulative lengths for backup line
    const backupCumulative = backup.reduce<number[]>((acc, curr) => {
      const prev = acc[acc.length - 1] || 0;
      return [...acc, prev + Number(curr.length)];
    }, []);
  
    for (const [index, backupPosition] of backupCumulative.entries()) {
      // Find closest main cumulative position
      const closestMainIndex = mainCumulative.findIndex(
        (mainPosition) => mainPosition >= backupPosition,
      );
  
      const comparisonIndex =
        closestMainIndex === -1
          ? mainCumulative.length - 1
          : Math.max(0, closestMainIndex - 1);
  
      const mainAbsoluteLength = mainCumulative[comparisonIndex];
  
      // Skip validation if connecting to anchor
      if (comparisonIndex === mainCumulative.length - 1) return;
  
      // Validate length difference
      const lengthDifference = backupPosition - mainAbsoluteLength;
  
      if (lengthDifference < 2 || lengthDifference > 10) {
        error = `Backup #${index + 1} deve ser 2-10 metros mais longa que a seção principal #${comparisonIndex + 1}`;
  
        break;
      }
    }
  
    return error;
  };
  