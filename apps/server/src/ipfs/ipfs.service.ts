import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const PINATA_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PINATA_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

/**
 * Pins files and JSON documents to IPFS via Pinata, returning the resulting CID.
 *
 * Only the CID is ever stored in the database and on-chain (Campaign.ipfsHash /
 * Milestone proof). The actual bytes live on IPFS and are fetched back through the
 * configured gateway. Uploads require PINATA_JWT to be set; when it is missing the
 * service reports itself as not configured so callers can fall back gracefully.
 */
@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  private readonly jwt: string;
  private readonly gateway: string;

  constructor(private readonly config: ConfigService) {
    this.jwt = (this.config.get<string>('pinataJwt') ?? '').trim();
    this.gateway =
      this.config.get<string>('ipfsGateway') ?? 'https://ipfs.io/ipfs/';
  }

  isConfigured(): boolean {
    return this.jwt.length > 0;
  }

  gatewayUrl(cid: string): string {
    return `${this.gateway}${cid}`;
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'IPFS uploads are not configured. Set PINATA_JWT on the server.',
      );
    }
  }

  /** Pin a raw file (image, pdf, doc) and return its CID. */
  async pinFile(
    buffer: Buffer,
    filename: string,
    mimetype: string,
  ): Promise<string> {
    this.ensureConfigured();
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(buffer)], {
        type: mimetype || 'application/octet-stream',
      }),
      filename,
    );
    form.append('pinataMetadata', JSON.stringify({ name: filename }));
    form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
    return this.post(PINATA_FILE_URL, form);
  }

  /** Pin a JSON document (campaign metadata, proof manifest) and return its CID. */
  async pinJSON(content: unknown, name: string): Promise<string> {
    this.ensureConfigured();
    const body = JSON.stringify({
      pinataContent: content,
      pinataMetadata: { name },
      pinataOptions: { cidVersion: 1 },
    });
    return this.post(PINATA_JSON_URL, body, {
      'Content-Type': 'application/json',
    });
  }

  private async post(
    url: string,
    body: FormData | string,
    extraHeaders: Record<string, string> = {},
  ): Promise<string> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.jwt}`, ...extraHeaders },
        body,
      });
    } catch (err) {
      this.logger.error(`Pinata request failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'Could not reach the IPFS pinning service.',
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Pinata responded ${res.status}: ${text}`);
      throw new ServiceUnavailableException('IPFS pinning failed.');
    }

    const data = (await res.json()) as { IpfsHash?: string };
    if (!data.IpfsHash) {
      throw new ServiceUnavailableException('IPFS pinning returned no CID.');
    }
    return data.IpfsHash;
  }
}
