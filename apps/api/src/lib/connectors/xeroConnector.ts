import { JournalLineItem } from '@settlement-agent/shared';

export interface XeroAuthCredentials {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  tenantId: string;
}

export interface XeroJournalLine {
  LineAmount: number; // In Xero: Debits are positive (+), Credits are negative (-)
  AccountCode: string;
  Description: string;
  TaxType?: string;
}

export interface XeroManualJournalPayload {
  Narration: string;
  Date: string; // YYYY-MM-DD
  Status: 'DRAFT' | 'POSTED';
  LineAmountTypes: 'NoTax' | 'Inclusive' | 'Exclusive';
  JournalLines: XeroJournalLine[];
}

export interface XeroAccount {
  AccountID: string;
  Code: string;
  Name: string;
  Type: string;
  Status: string;
}

/**
 * Xero Direct REST Connector
 * 
 * Enforces Isaiah's Anti-Hallucination Law:
 * Only receives journal lines AFTER the Deterministic Math Gate has verified
 * double-entry equilibrium and net cash waterfall consistency.
 */
export class XeroConnector {
  private credentials: XeroAuthCredentials;

  constructor(credentials: XeroAuthCredentials) {
    this.credentials = credentials;
  }

  /**
   * Refreshes the OAuth 2.0 access token using Xero's token rotation endpoint.
   * Xero rotates the refresh token on every call; caller must persist the new token.
   */
  async refreshToken(): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const response = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${this.credentials.clientId}:${this.credentials.clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.credentials.refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Xero OAuth token refresh failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as any;
    this.credentials.accessToken = data.access_token;
    this.credentials.refreshToken = data.refresh_token;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Dynamic Discovery: Reads the live Chart of Accounts from Xero.
   * Allows the AI Agent to inspect client-specific account codes dynamically.
   */
  async fetchAccounts(): Promise<XeroAccount[]> {
    const response = await fetch('https://api.xero.com/api.xro/2.0/Accounts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Xero-Tenant-Id': this.credentials.tenantId,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch Xero accounts (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as any;
    return (data.Accounts || []).map((acc: any) => ({
      AccountID: acc.AccountID,
      Code: acc.Code,
      Name: acc.Name,
      Type: acc.Type,
      Status: acc.Status,
    }));
  }

  /**
   * Formats Settlement Agent journal lines into Xero's native ManualJournals schema.
   * 
   * CRITICAL ACCOUNTING CONVENTION IN XERO:
   * - Debits are entered as POSITIVE LineAmount values.
   * - Credits are entered as NEGATIVE LineAmount values.
   */
  formatManualJournalPayload(params: {
    batchId: string;
    payoutDate: string;
    lines: JournalLineItem[];
    status: 'POSTED' | 'DRAFT';
    reason?: string;
  }): XeroManualJournalPayload {
    const dateFormatted = params.payoutDate.includes('T')
      ? params.payoutDate.split('T')[0]
      : params.payoutDate;

    let narration = `Settlement Batch ${params.batchId}`;
    if (params.reason) {
      narration += ` [AUDIT ESCALATION: ${params.reason}]`;
    }

    const journalLines: XeroJournalLine[] = params.lines.map((line) => {
      // In Xero: Debits > 0 are positive (+), Credits > 0 are negative (-)
      const lineAmount = line.debit > 0 
        ? Math.round(line.debit * 100) / 100 
        : -Math.abs(Math.round(line.credit * 100) / 100);

      return {
        AccountCode: line.accountCode,
        Description: line.description,
        LineAmount: lineAmount,
        TaxType: line.taxJurisdiction ? 'OUTPUT' : 'NONE',
      };
    });

    return {
      Narration: narration,
      Date: dateFormatted,
      Status: params.status,
      LineAmountTypes: 'NoTax',
      JournalLines: journalLines,
    };
  }

  /**
   * Posts the validated manual journal directly to Xero via REST.
   * If status is 'DRAFT', it stages safely in Xero without altering the general ledger.
   */
  async postManualJournal(params: {
    batchId: string;
    payoutDate: string;
    lines: JournalLineItem[];
    status: 'POSTED' | 'DRAFT';
    reason?: string;
  }): Promise<{ manualJournalId: string; status: string; rawResponse: any }> {
    const payload = this.formatManualJournalPayload(params);

    const response = await fetch('https://api.xero.com/api.xro/2.0/ManualJournals', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Xero-Tenant-Id': this.credentials.tenantId,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        ManualJournals: [payload],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Xero ManualJournals POST failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as any;
    const createdJournal = data.ManualJournals?.[0];

    return {
      manualJournalId: createdJournal?.ManualJournalID || 'UNKNOWN_ID',
      status: createdJournal?.Status || params.status,
      rawResponse: data,
    };
  }
}
