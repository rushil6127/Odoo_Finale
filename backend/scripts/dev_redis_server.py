"""Local development Redis server utility using fakeredis TCP socket server."""
import sys
import fakeredis


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 6379
    server = fakeredis.TcpFakeServer(("127.0.0.1", port))
    print(f"[*] Local Redis service listening on 127.0.0.1:{port}", flush=True)
    try:
        server.serve_forever()
    except (KeyboardInterrupt, SystemExit):
        server.shutdown()


if __name__ == "__main__":
    main()
