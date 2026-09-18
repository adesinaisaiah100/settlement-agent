import { JournalLineItem } from '@settlement-agent/shared';

export interface QBOAuthCredentials {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  realmId: string;
}

export interface QBOJournalEntryLine {
  Id: string;
  Description: string;
  Amount: number; // Always positive decimal in QBO
  DetailType: 'JournalEntryLineDetail';
  JournalEntryLineDetail: {
    PostingType: 'Debit' | 'Credit';
    AccountRef: {
      value: string; // Account ID or code
      name: string;
    };
  };
}

export interface QBOJournalEntryPayload {
  DocNumber: string;
  TxnDate: string; // YYYY-MM-DD
  PrivateNote: string;
  Line: QBOJournalEntryLine[];
}

export interface QBOAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  Active: boolean;
}

/**
 * QuickBooks Online (QBO) Direct REST Connector
 * 
 * Interacts with Intuit v3 Accounting API with strict formatting:
 * - Forbids negative numbers (uses PostingType 'Debit' / 'Credit')
 * - Automatic token rotation
 * - Dynamic Account discovery
 */
export class QBOConnector {
  private credentials: QBOAuthCredentials;

  constructor(credentials: QBOAuthCredentials) {
    this.credentials = credentials;
  }

  /**
   * Refreshes Intuit OAuth 2.0 access token using refresh token rotation.
   */
  async refreshToken(): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const basicAuth = btoa(`${this.credentials.clientId}:${this.credentials.clientSecret}`);

    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.credentials.refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QBO OAuth token refresh failed (${response.status}): ${errorText}`);
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
   * Dynamic Discovery: Queries QuickBooks Online Chart of Accounts.
   */
  async fetchAccounts(): Promise<QBOAccount[]> {
    const query = encodeURIComponent('SELECT * FROM Account MAXRESULTS 1000');
    const url = `https://quickbooks.api.intuit.com/v3/company/${this.credentials.realmId}/query?query=${query}&minorversion=75`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch QBO accounts (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as any;
    const accounts = data.QueryResponse?.Account || [];

    return accounts.map((acc: any) => ({
      Id: acc.Id,
      Name: acc.Name,
      AccountType: acc.AccountType,
      AccountSubType: acc.AccountSubType,
      Active: acc.Active,
    }));
  }

  /**
   * Formats Settlement Agent journal lines into Intuit QBO JournalEntry schema.
   * 
   * CRITICAL ACCOUNTING CONVENTION IN QBO:
   * - Amounts MUST ALWAYS BE POSITIVE decimals.
   * - Debits are marked with PostingType: "Debit".
   * - Credits are marked with PostingType: "Credit".
   */
  formatJournalEntryPayload(params: {
    batchId: string;
    payoutDate: string;
    lines: JournalLineItem[];
    reason?: string;
  }): QBOJournalEntryPayload {
    const dateFormatted = params.payoutDate.includes('T')
      ? params.payoutDate.split('T')[0]
      : params.payoutDate;

    let privateNote = `Settlement Agent Reconciliation for Batch ${params.batchId}`;
    if (params.reason) {
      privateNote += ` [MACHINE AUDIT: ${params.reason}]`;
    }

    const lines: QBOJournalEntryLine[] = params.lines.map((line, idx) => {
      const isDebit = line.debit > 0;
      const amount = isDebit 
        ? Math.round(line.debit * 100) / 100 
        : Math.round(line.credit * 100) / 100;

      return {
        Id: String(idx + 1),
        Description: line.description,
        Amount: amount,
        DetailType: 'JournalEntryLineDetail',
        JournalEntryLineDetail: {
          PostingType: isDebit ? 'Debit' : 'Credit',
          AccountRef: {
            value: line.accountCode,
            name: line.accountName,
          },
        },
      };
    });

    return {
      DocNumber: params.batchId,
      TxnDate: dateFormatted,
      PrivateNote: privateNote,
      Line: lines,
    };
  }

  /**
   * Posts the validated journal entry to QuickBooks Online.
   */
  async postJournalEntry(params: {
    batchId: string;
    payoutDate: string;
    lines: JournalLineItem[];
    reason?: string;
  }): Promise<{ journalEntryId: string; docNumber: string; rawResponse: any }> {
    const payload = this.formatJournalEntryPayload(params);
    const url = `https://quickbooks.api.intuit.com/v3/company/${this.credentials.realmId}/journalentry?minorversion=75`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QBO JournalEntry POST failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as any;
    const createdEntry = data.JournalEntry;

    return {
      journalEntryId: createdEntry?.Id || 'UNKNOWN_ID',
      docNumber: createdEntry?.DocNumber || params.batchId,
      rawResponse: data,
    };
  }
}
